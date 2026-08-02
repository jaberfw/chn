<?php
declare(strict_types=1);
define('ADMIN_PASSWORD_HASH', password_hash('admin123', PASSWORD_DEFAULT));
define('ADMIN_SESSION_NAME','cn_admin_session');
define('DATABASE_PATH', __DIR__.'/../database.json');
define('BACKUP_DIR', __DIR__.'/backups');
define('AUDIO_DIR', __DIR__.'/../audio');
define('MAX_AUDIO_SIZE', 10485760);
define('ALLOWED_AUDIO_EXT', ['mp3','wav','ogg','m4a','aac']);
$SETTINGS=['theme'=>'light','items_per_page'=>25,'backup_count'=>30];
if(file_exists(__DIR__.'/settings.local.php')) require __DIR__.'/settings.local.php';
?>