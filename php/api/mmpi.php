<?php
/**
 * MMPI statik kurulum API'si — tek uç nokta.
 * Ön yüz (statik dist) buraya JSON POST atar: { "action": "...", ... }
 */
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

$cfg = require __DIR__ . '/config.php';
require __DIR__ . '/smtp.php';

function respond($data, int $status = 200): void
{
    http_response_code($status);
    echo json_encode(['ok' => $status < 400, 'data' => $data], JSON_UNESCAPED_UNICODE);
    exit;
}

function fail(string $message, int $status = 400): void
{
    http_response_code($status);
    echo json_encode(['ok' => false, 'error' => $message], JSON_UNESCAPED_UNICODE);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    fail('Sadece POST kabul edilir.', 405);
}

$input = json_decode(file_get_contents('php://input') ?: '{}', true);
if (!is_array($input)) {
    fail('Geçersiz istek gövdesi.');
}
$action = (string) ($input['action'] ?? '');
$token = isset($input['token']) ? (string) $input['token'] : null;

try {
    $pdo = new PDO(
        "mysql:host={$cfg['db_host']};dbname={$cfg['db_name']};charset=utf8mb4",
        $cfg['db_user'],
        $cfg['db_pass'],
        [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]
    );
} catch (Throwable $e) {
    fail('Veritabanına bağlanılamadı. config.php ayarlarını kontrol edin.', 500);
}

// Tablolar yoksa oluştur (ilk çalıştırmada otomatik kurulum).
$pdo->exec("CREATE TABLE IF NOT EXISTS test_sessions (
    id CHAR(36) NOT NULL PRIMARY KEY,
    session_token CHAR(36) NOT NULL UNIQUE,
    full_name VARCHAR(160) NOT NULL,
    age INT NOT NULL,
    gender VARCHAR(10) NOT NULL,
    phone VARCHAR(30) NOT NULL,
    email VARCHAR(190) NOT NULL,
    ip_address VARCHAR(60) NULL,
    user_agent TEXT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'in_progress',
    started_at DATETIME NOT NULL,
    finished_at DATETIME NULL,
    duration_seconds INT NOT NULL DEFAULT 0,
    answered_count INT NOT NULL DEFAULT 0,
    last_question INT NOT NULL DEFAULT 1,
    leave_count INT NOT NULL DEFAULT 0,
    last_left_at DATETIME NULL,
    last_returned_at DATETIME NULL,
    email_sent_at DATETIME NULL,
    results LONGTEXT NULL,
    created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS test_answers (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    question_no INT NOT NULL,
    answer CHAR(1) NOT NULL,
    created_at DATETIME NOT NULL,
    UNIQUE KEY uniq_answer (session_id, question_no),
    KEY idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

$pdo->exec("CREATE TABLE IF NOT EXISTS session_events (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    session_id CHAR(36) NOT NULL,
    event_type VARCHAR(30) NOT NULL,
    question_no INT NULL,
    ip_address VARCHAR(60) NULL,
    created_at DATETIME NOT NULL,
    KEY idx_session (session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

function uuid(): string
{
    $b = random_bytes(16);
    $b[6] = chr((ord($b[6]) & 0x0f) | 0x40);
    $b[8] = chr((ord($b[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($b), 4));
}

function client_ip(): ?string
{
    foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_REAL_IP', 'HTTP_X_FORWARDED_FOR', 'REMOTE_ADDR'] as $key) {
        if (!empty($_SERVER[$key])) {
            return trim(explode(',', (string) $_SERVER[$key])[0]);
        }
    }
    return null;
}

function tr_date(?string $value): string
{
    return $value ? date('d.m.Y H:i:s', strtotime($value)) : '-';
}

$now = date('Y-m-d H:i:s');
$ip = client_ip();

// ---------------- admin ----------------
if ($action === 'admin') {
    if (($input['username'] ?? null) !== $cfg['admin_user'] || ($input['password'] ?? null) !== $cfg['admin_pass']) {
        fail('Kullanıcı adı veya şifre hatalı.', 401);
    }
    $rows = $pdo->query("SELECT id, full_name, age, gender, phone, email, ip_address, status, started_at,
        finished_at, duration_seconds, answered_count, last_question, leave_count, last_left_at,
        last_returned_at, email_sent_at, results FROM test_sessions ORDER BY created_at DESC LIMIT 500")->fetchAll();
    foreach ($rows as &$row) {
        $row['results'] = $row['results'] ? json_decode($row['results'], true) : null;
        $row['age'] = (int) $row['age'];
    }
    respond(['sessions' => $rows]);
}

// ---------------- start ----------------
if ($action === 'start') {
    $id = uuid();
    $newToken = uuid();
    $stmt = $pdo->prepare("INSERT INTO test_sessions
        (id, session_token, full_name, age, gender, phone, email, ip_address, user_agent, started_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)");
    $stmt->execute([
        $id,
        $newToken,
        trim((string) ($input['fullName'] ?? '')),
        (int) ($input['age'] ?? 0),
        (string) ($input['gender'] ?? 'male'),
        trim((string) ($input['phone'] ?? '')),
        trim((string) ($input['email'] ?? '')),
        $ip,
        $_SERVER['HTTP_USER_AGENT'] ?? null,
        $now,
        $now,
    ]);
    $pdo->prepare("INSERT INTO session_events (session_id, event_type, ip_address, created_at) VALUES (?,?,?,?)")
        ->execute([$id, 'test_started', $ip, $now]);
    respond(['token' => $newToken]);
}

if (!$token) {
    fail('Geçersiz istek.');
}

$stmt = $pdo->prepare("SELECT * FROM test_sessions WHERE session_token = ? LIMIT 1");
$stmt->execute([$token]);
$session = $stmt->fetch();

// ---------------- get ----------------
if ($action === 'get') {
    if (!$session) {
        respond(null);
    }
    $answersStmt = $pdo->prepare("SELECT question_no, answer FROM test_answers WHERE session_id = ?");
    $answersStmt->execute([$session['id']]);
    $answers = [];
    foreach ($answersStmt->fetchAll() as $row) {
        $answers[(string) $row['question_no']] = $row['answer'];
    }
    respond([
        'token' => $token,
        'participant' => [
            'full_name' => $session['full_name'],
            'age' => (int) $session['age'],
            'gender' => $session['gender'],
            'phone' => $session['phone'],
            'email' => $session['email'],
        ],
        'status' => $session['status'],
        'startedAt' => tr_date($session['started_at']),
        'finishedAt' => tr_date($session['finished_at']),
        'leaveCount' => (int) $session['leave_count'],
        'lastLeftAt' => $session['last_left_at'] ? tr_date($session['last_left_at']) : null,
        'lastReturnedAt' => $session['last_returned_at'] ? tr_date($session['last_returned_at']) : null,
        'durationSeconds' => (int) $session['duration_seconds'],
        'lastQuestion' => (int) $session['last_question'],
        'answers' => $answers ?: new stdClass(),
        'results' => $session['results'] ? json_decode($session['results'], true) : null,
    ]);
}

if (!$session) {
    fail('Oturum bulunamadı.', 404);
}

// ---------------- answer ----------------
if ($action === 'answer') {
    if ($session['status'] === 'completed') {
        fail('Bu test zaten tamamlandı.', 409);
    }
    $questionNo = (int) ($input['questionNo'] ?? 0);
    $answer = ($input['answer'] ?? 'D') === 'Y' ? 'Y' : 'D';

    $check = $pdo->prepare("SELECT id FROM test_answers WHERE session_id = ? AND question_no = ?");
    $check->execute([$session['id'], $questionNo]);
    $locked = (bool) $check->fetch();

    // Cevaplar kilitlidir: verilmiş cevap değiştirilemez.
    if (!$locked) {
        $pdo->prepare("INSERT INTO test_answers (session_id, question_no, answer, created_at) VALUES (?,?,?,?)")
            ->execute([$session['id'], $questionNo, $answer, $now]);
    }

    $countStmt = $pdo->prepare("SELECT COUNT(*) FROM test_answers WHERE session_id = ?");
    $countStmt->execute([$session['id']]);
    $count = (int) $countStmt->fetchColumn();

    $pdo->prepare("UPDATE test_sessions SET duration_seconds = ?, last_question = ?, answered_count = ? WHERE id = ?")
        ->execute([
            (int) ($input['elapsedSeconds'] ?? 0),
            (int) ($input['lastQuestion'] ?? $questionNo),
            $count,
            $session['id'],
        ]);
    respond(['locked' => $locked, 'answeredCount' => $count]);
}

// ---------------- event ----------------
if ($action === 'event') {
    $eventType = (string) ($input['eventType'] ?? '');
    $questionNo = isset($input['questionNo']) ? (int) $input['questionNo'] : null;
    $pdo->prepare("INSERT INTO session_events (session_id, event_type, question_no, ip_address, created_at) VALUES (?,?,?,?,?)")
        ->execute([$session['id'], $eventType, $questionNo, $ip, $now]);

    $sets = [];
    $params = [];
    if ($eventType === 'left_page') {
        $sets[] = 'last_left_at = ?';
        $params[] = $now;
        $sets[] = 'leave_count = leave_count + 1';
    }
    if ($eventType === 'returned_page') {
        $sets[] = 'last_returned_at = ?';
        $params[] = $now;
    }
    if (isset($input['elapsedSeconds'])) {
        $sets[] = 'duration_seconds = ?';
        $params[] = (int) $input['elapsedSeconds'];
    }
    if ($questionNo) {
        $sets[] = 'last_question = ?';
        $params[] = $questionNo;
    }
    if ($sets) {
        $params[] = $session['id'];
        $pdo->prepare('UPDATE test_sessions SET ' . implode(', ', $sets) . ' WHERE id = ?')->execute($params);
    }
    respond(['ok' => true]);
}

// ---------------- restart ----------------
if ($action === 'restart') {
    $id = uuid();
    $newToken = uuid();
    $pdo->prepare("INSERT INTO test_sessions
        (id, session_token, full_name, age, gender, phone, email, ip_address, user_agent, started_at, created_at)
        VALUES (?,?,?,?,?,?,?,?,?,?,?)")
        ->execute([
            $id,
            $newToken,
            $session['full_name'],
            $session['age'],
            $session['gender'],
            $session['phone'],
            $session['email'],
            $ip,
            $_SERVER['HTTP_USER_AGENT'] ?? null,
            $now,
            $now,
        ]);
    $pdo->prepare("UPDATE test_sessions SET status = 'abandoned' WHERE id = ?")->execute([$session['id']]);
    $pdo->prepare("INSERT INTO session_events (session_id, event_type, ip_address, created_at) VALUES (?,?,?,?)")
        ->execute([$id, 'test_restarted', $ip, $now]);
    respond(['token' => $newToken]);
}

// ---------------- finish ----------------
if ($action === 'finish') {
    $results = $input['results'] ?? null;
    $elapsed = (int) ($input['elapsedSeconds'] ?? 0);
    $pdo->prepare("UPDATE test_sessions SET status = 'completed', finished_at = ?, duration_seconds = ?,
        answered_count = ?, results = ? WHERE id = ?")
        ->execute([
            $now,
            $elapsed,
            (int) ($results['answered'] ?? 0),
            $results ? json_encode($results, JSON_UNESCAPED_UNICODE) : null,
            $session['id'],
        ]);
    $pdo->prepare("INSERT INTO session_events (session_id, event_type, ip_address, created_at) VALUES (?,?,?,?)")
        ->execute([$session['id'], 'test_completed', $ip, $now]);

    respond([
        'participant' => [
            'full_name' => $session['full_name'],
            'age' => (int) $session['age'],
            'gender' => $session['gender'],
            'phone' => $session['phone'],
            'email' => $session['email'],
            'ip_address' => $session['ip_address'],
            'duration_seconds' => $elapsed,
            'started_at' => tr_date($session['started_at']),
            'finished_at' => tr_date($now),
            'leave_count' => (int) $session['leave_count'],
            'last_left_at' => $session['last_left_at'] ? tr_date($session['last_left_at']) : null,
            'last_returned_at' => $session['last_returned_at'] ? tr_date($session['last_returned_at']) : null,
        ],
    ]);
}

// ---------------- email (SMTP) ----------------
if ($action === 'email') {
    $subject = (string) ($input['subject'] ?? 'MMPI Test Sonucu');
    try {
        mmpi_smtp_send($cfg, (string) $session['email'], $subject, (string) ($input['participantHtml'] ?? ''));
        mmpi_smtp_send($cfg, (string) $cfg['admin_email'], $subject . ' (yönetim kopyası)', (string) ($input['adminHtml'] ?? ''));
        $pdo->prepare("UPDATE test_sessions SET email_sent_at = ? WHERE id = ?")->execute([$now, $session['id']]);
        respond(['sent' => true]);
    } catch (Throwable $e) {
        respond(['sent' => false, 'error' => $e->getMessage()]);
    }
}

fail('Bilinmeyen işlem.');
