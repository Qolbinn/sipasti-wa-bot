import fs from 'fs';
import path from 'path';
import { makeWASocket, useMultiFileAuthState } from '@whiskeysockets/baileys';
import pino from 'pino';

const pnListPath = path.join(process.cwd(), 'scripts', 'pn_list.json');
const lidListPath = path.join(process.cwd(), 'scripts', 'lid_list.json');

async function convertPNtoLID() {

    // 2. Baca daftar kontak
    let contacts = [];
    try {
        contacts = JSON.parse(fs.readFileSync(pnListPath, 'utf-8'));
    } catch (error) {
        console.error('❌ Gagal membaca pn_list.json. Pastikan format JSON sudah benar.', error.message);
        process.exit(1);
    }

    if (!Array.isArray(contacts) || contacts.length === 0) {
        console.log('⚠️ pn_list.json kosong atau tidak valid.');
        process.exit(0);
    }

    console.log('⏳ Menyiapkan koneksi ke WhatsApp dari sesi yang tersimpan...');
    const { state } = await useMultiFileAuthState('auth_info_baileys');

    const sock = makeWASocket({
        auth: state,
        logger: pino({ level: 'silent' })
    });

    sock.ev.on('connection.update', async (update) => {
        const { connection } = update;

        if (connection === 'open') {
            console.log('✅ Berhasil terhubung ke server WhatsApp!');
            console.log(`🔍 Sedang meminta data LID untuk ${contacts.length} kontak...\n`);

            try {
                // Ekstrak phone number
                const pnjids = contacts.map(c => {
                    const cleaned = String(c.phone).replace(/\D/g, '');
                    return `${cleaned}@s.whatsapp.net`;
                });

                // Tarik LID dari server
                const mappings = await sock.signalRepository.lidMapping.getLIDsForPNs(pnjids);

                // Masukkan LID ke dalam object contacts
                const results = contacts.map(contact => {
                    const cleanedPhone = String(contact.phone).replace(/\D/g, '');
                    const match = mappings.find(m => m.pn.startsWith(cleanedPhone));

                    return {
                        phone: cleanedPhone,
                        lid: match && match.lid ? match.lid.split('@')[0] : null,
                        name: contact.name || '',
                        description: contact.description || ''
                    };
                });

                // Tulis hasil ke lid_list.json
                fs.writeFileSync(lidListPath, JSON.stringify(results, null, 2));

                console.log('================ HASIL KONVERSI ================');
                results.forEach((r, index) => {
                    console.log(`(${index + 1}) HP  : ${r.phone}`);
                    console.log(`    LID : ${r.lid || 'Tidak Ditemukan'}`);
                    console.log(`    Nama: ${r.name}`);
                    console.log('------------------------------------------------');
                });
                console.log('================================================\n');
                console.log(`✅ Selesai! Hasil konversi telah disimpan ke file:\n   ${lidListPath}`);
                console.log('\nTIPS: Anda dapat meng-copy isi lid_list.json ke dalam allowed_numbers.json atau ignored_numbers.json');

            } catch (error) {
                console.error('❌ Terjadi kesalahan saat mengonversi nomor:', error.message);
            }

            console.log('\nTugas selesai! Memutuskan koneksi...');
            sock.ws.close();
            process.exit(0);
        }
    });
}

convertPNtoLID();
