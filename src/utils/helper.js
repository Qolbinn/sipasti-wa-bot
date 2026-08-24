/**
 * Memberikan jeda waktu acak (dalam milidetik).
 * Digunakan untuk mekanisme anti-spam agar perilaku bot terlihat seperti manusia.
 * 
 * @param {number} min - Jeda minimum dalam ms
 * @param {number} max - Jeda maksimum dalam ms
 * @returns {Promise<void>}
 */
export const randomDelay = (min = 3000, max = 5000) => {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    return new Promise((resolve) => setTimeout(resolve, delay));
};
