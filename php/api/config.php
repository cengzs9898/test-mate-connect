<?php
/**
 * cPanel kurulum ayarları — bu dosyayı sunucunuzda düzenleyin.
 * Bu dosya web'den okunamaz (bkz. .htaccess) ama yine de gizli tutun.
 */

return [
    // ---- MySQL (cPanel > MySQL Veritabanları) ----
    'db_host' => 'localhost',
    'db_name' => 'CPANELKULLANICI_mmpi',
    'db_user' => 'CPANELKULLANICI_mmpi',
    'db_pass' => 'VERITABANI_SIFRESI',

    // ---- SMTP (sonuç e-postaları) ----
    'smtp_host'   => 'srvc67.trwww.com',
    'smtp_port'   => 465,
    'smtp_secure' => 'ssl', // 465 için 'ssl', 587 için 'tls'
    'smtp_user'   => 'mmpitesti@pruvapsikoloji.com',
    'smtp_pass'   => '@pruvapsikoloji.com',
    'mail_from'   => 'mmpitesti@pruvapsikoloji.com',
    'mail_from_name' => 'Pruva MMPI Testi',
    'admin_email' => 'mmpitesti@pruvapsikoloji.com',

    // ---- Yönetim paneli (/admin) ----
    'admin_user' => 'admin',
    'admin_pass' => '@pruvapsikoloji.com',
];
