<?php
/**
 * Bağımlılık gerektirmeyen minimal SMTP istemcisi (AUTH LOGIN, SSL/TLS).
 * PHP'nin openssl uzantısı yeterlidir; Composer / PHPMailer gerekmez.
 */

function mmpi_smtp_send(array $cfg, string $to, string $subject, string $html): void
{
    $host = $cfg['smtp_host'];
    $port = (int) $cfg['smtp_port'];
    $secure = strtolower((string) $cfg['smtp_secure']);
    $transport = $secure === 'ssl' ? "ssl://$host" : $host;

    $socket = @stream_socket_client("$transport:$port", $errno, $errstr, 30);
    if (!$socket) {
        throw new Exception("SMTP bağlantısı kurulamadı: $errstr ($errno)");
    }
    stream_set_timeout($socket, 30);

    $read = function () use ($socket): string {
        $data = '';
        while (($line = fgets($socket, 1024)) !== false) {
            $data .= $line;
            if (strlen($line) < 4 || $line[3] !== '-') {
                break;
            }
        }
        return $data;
    };
    $expect = function (string $response, string $code, string $step): void {
        if (strpos($response, $code) !== 0) {
            throw new Exception("SMTP $step hatası: " . trim($response));
        }
    };
    $send = function (string $command) use ($socket, $read): string {
        fwrite($socket, $command . "\r\n");
        return $read();
    };

    $expect($read(), '220', 'karşılama');
    $expect($send('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost')), '250', 'EHLO');

    if ($secure === 'tls') {
        $expect($send('STARTTLS'), '220', 'STARTTLS');
        if (!stream_socket_enable_crypto($socket, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
            throw new Exception('TLS el sıkışması başarısız.');
        }
        $expect($send('EHLO ' . ($_SERVER['HTTP_HOST'] ?? 'localhost')), '250', 'EHLO (TLS)');
    }

    $expect($send('AUTH LOGIN'), '334', 'AUTH');
    $expect($send(base64_encode((string) $cfg['smtp_user'])), '334', 'kullanıcı adı');
    $expect($send(base64_encode((string) $cfg['smtp_pass'])), '235', 'şifre');

    $from = (string) $cfg['mail_from'];
    $expect($send('MAIL FROM:<' . $from . '>'), '250', 'MAIL FROM');
    $expect($send('RCPT TO:<' . $to . '>'), '250', 'RCPT TO');
    $expect($send('DATA'), '354', 'DATA');

    $fromName = '=?UTF-8?B?' . base64_encode((string) $cfg['mail_from_name']) . '?=';
    $headers = [
        'From: ' . $fromName . ' <' . $from . '>',
        'To: <' . $to . '>',
        'Subject: =?UTF-8?B?' . base64_encode($subject) . '?=',
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=UTF-8',
        'Content-Transfer-Encoding: base64',
        'Date: ' . date('r'),
        'Message-ID: <' . bin2hex(random_bytes(12)) . '@' . ($_SERVER['HTTP_HOST'] ?? 'localhost') . '>',
    ];
    $body = chunk_split(base64_encode($html), 76, "\r\n");
    fwrite($socket, implode("\r\n", $headers) . "\r\n\r\n" . $body . "\r\n.\r\n");
    $expect($read(), '250', 'gönderim');

    $send('QUIT');
    fclose($socket);
}
