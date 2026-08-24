import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';

async function start() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'error' }), // Matikan log bawaan agar rapi
    });

    sock.ev.on('creds.update', saveCreds);

    console.log("✅ Terhubung ke WhatsApp!");
    console.log("==========================================");
    console.log("TUTORIAL MENDAPATKAN ID LABEL:");
    console.log("1. Buka aplikasi WhatsApp Business di HP Anda.");
    console.log("2. Edit nama label 'Tindak Lanjut' (misal tambahkan spasi lalu hapus lagi), ATAU");
    console.log("3. Pasang label 'Tindak Lanjut' ke salah satu obrolan sembarang.");
    console.log("==========================================\n");
    console.log("Menunggu aktivitas label dari HP Anda...\n");

    // Menangkap event ketika ada label yang dibuat/diedit
    sock.ev.on('labels.edit', (label) => {
        console.log("🚨 [MENDETEKSI LABEL DIEDIT/DIBUAT]");
        console.log(JSON.stringify(label, null, 2));
        console.log(`\n=> ID Label Anda adalah: "${label.id}"\n`);
    });

    // Menangkap event ketika label dipasangkan ke sebuah chat
    sock.ev.on('labels.association', (association) => {
        console.log("🚨 [MENDETEKSI LABEL DIPASANGKAN KE CHAT]");
        console.log(JSON.stringify(association, null, 2));
        console.log(`\n=> ID Label yang baru saja Anda pasang adalah: "${association.association.labelId}"\n`);
    });
}

start();
