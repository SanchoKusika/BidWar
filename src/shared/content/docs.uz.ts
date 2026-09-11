import type { DocPage } from './types';
import type { DocId } from './docs.en';

/** Huquqiy va ma'lumot sahifalari, o'zbekcha (lotin). */
export const docsUz: Record<DocId, DocPage> = {
  about: {
    icon: 'info',
    title: 'BidWar haqida',
    lead: "O'rnini sotib olish mumkin bo'lgan reyting, va hammasi ochiq. Platforma qancha ishlashi shu sahifada yozilgan.",
    facts: [
      ['Daromad manbai', "Har bir to'lov"],
      ['Stavkangizdan ushlab qolish', "Yo'q"],
      ['Platformaning stavkalari', 'Hech qachon'],
    ],
    sections: [
      {
        h: 'Bu nima',
        p: "Loyihalarning ikkita reytingi — kanallar, botlar, saytlar, bizneslar. Biri pul bo'yicha, ikkinchisi topshiriqlardan olingan ovozlar bo'yicha tartiblangan. Yuqori o'rin haqiqiy trafik beradi: har bir qatordagi o'tishlar hisoblagichi — biz va'da qiladigan yagona narsa.",
      },
      {
        h: 'Pulingiz qayerga ketadi',
        p: "Har bir to'lov — bizning daromadimiz, ko'tarish ham, hujum ham. Biz hech qachon qilmaydigan narsa — stavkangizdan ushlab qolish: 100 000 so'm to'lasangiz, 100 000 so'm stavkaga tushadi. Yagona istisno — bitta raqibga takroriy hujumlar, u yerda summaning bir qismi stavkangizga aylanmaydi. Bu ataylab: ikki kishi bir-biriga bepul hujum aylantirmasin.",
      },
      {
        h: 'Nega raqamlar ochiq',
        p: "Pulli reyting faqat hech kim platformani o'z ro'yxatida stavka qo'yishda gumon qilmagandagina ishlaydi. Shuning uchun biz daromadni ham, bord bergan trafikni ham e'lon qilamiz.",
      },
      {
        h: 'Biz qilmaydigan ishlar',
        p: "Ovozlarni sotmaymiz, ovozni pulga yoki pulni ovozga almashtirmaymiz, o'z nomimizdan stavka qo'ymaymiz va ro'yxatni qo'lda qayta terib chiqmaymiz. O'rin — arifmetika, tahririyat qarori emas.",
      },
    ],
  },
  support: {
    icon: 'life-buoy',
    title: "Qo'llab-quvvatlash",
    lead: "Bitta jamoa, uchta til, bitta navbat. To'lov muammolari navbatsiz ko'riladi.",
    facts: [
      ['Javob muddati', '24 soatgacha'],
      ['Ish vaqti', '09:00 – 21:00 (UTC+5)'],
      ['Tillar', 'RU · UZ · EN'],
    ],
    sections: [
      {
        h: "Eng qisqa yo'l",
        p: "Loyiha egasi bo'lgan akkauntdan telegram-botga yozing: u yerda biz loyihalaringizni, stavkalaringizni va oxirgi to'lovlaringizni darhol ko'ramiz.",
      },
      {
        h: "To'lov muammolari",
        p: "«Profil → Cheklar» bo'limidan to'lov raqamini yuboring. GlobalPay va Platega raqamlari yechimni topish uchun yetarli, karta ma'lumotlari kerak emas.",
      },
      {
        h: "Loyihalar o'rtasidagi nizolar",
        p: "Hujum — mexanika, qoidabuzarlik emas, va u bekor qilinmaydi. Begona brend nomidan ish ko'rish, o'g'irlangan ko'rinish va soxta tasdiq — qoidabuzarlik: havola va skrinshot yuboring.",
      },
    ],
  },
  terms: {
    icon: 'file-text',
    title: 'Foydalanish shartlari',
    lead: "Avval qisqa va sodda, to'liq huquqiy matnni bot so'rovga ko'ra yuboradi.",
    facts: [
      ['Akkauntga yozuvlar', '2'],
      ['Pul hisobi', "Yo'q"],
      ['Ovoz ↔ pul', 'Hech qachon'],
    ],
    sections: [
      {
        h: 'Ikki iqtisod',
        p: "To'lovli top pulda, bepul top ovozlarda ishlaydi. Biri ikkinchisiga hech qaysi tomonga aylanmaydi. Sizning pul hisobingiz bizda yo'q: hech narsa turmaydi va yechib olinmaydi.",
      },
      {
        h: 'Sizning loyihangiz',
        p: "Siz havolaga egalik qilishingizni yoki uni vakillik qilishingizni tasdiqlaysiz, va bitta akkauntda ko'pi bilan ikkita yozuv bo'ladi — har topga bittadan. Chalg'ituvchi, mahalliy qonunni buzadigan yoki boshqaning nomini nusxalaydigan loyihalarni rad etishimiz yoki olib tashlashimiz mumkin.",
      },
      {
        h: "To'lovlar",
        p: "Har bir ko'tarish, hujum va ochilish stavkasi — GlobalPay (O'zbekiston) yoki Platega (Rossiya va MDH) orqali alohida yechim. Biz to'lov raqami va summasini saqlaymiz, hech qachon karta ma'lumotlarini va hech qachon balansni emas.",
      },
      {
        h: 'Taqiqlanadi',
        p: "Ovozlarni avtomatik yig'ish, bitta loyiha uchun bir nechta akkaunt, ovoz savdosi va ovozni pulga sotib olishga urinish.",
      },
      {
        h: 'Tugatish',
        p: 'Loyihalaringizni istalgan vaqtda profildan topdan olib tashlashingiz mumkin. Turgan stavkalar bunda qaytarilmaydi.',
      },
    ],
  },
  privacy: {
    icon: 'lock',
    title: 'Maxfiylik',
    lead: "Reytingga ishonish mumkin bo'ladigan eng kichik ma'lumot to'plamini saqlaymiz.",
    facts: [
      ["Ma'lumot hududi", 'Germaniya · Frankfurt'],
      ['Saqlash muddati', '18 oy'],
      ["Karta ma'lumotlari", 'Saqlanmaydi'],
    ],
    sections: [
      {
        h: 'Nimani saqlaymiz',
        p: "Telegram id va foydalanuvchi nomi, loyihalaringiz havolalari, ovoz balansi, stavkalar, hujumlar, ovozlar va GlobalPay hamda Platega to'lov raqamlari.",
      },
      {
        h: 'Nimani hech qachon saqlamaymiz',
        p: "Karta raqamlari, CVV, bank ko'chirmalari, Telegramdagi xabarlaringiz va kontaktlar ro'yxati. Taklif havolasida kod bor, shaxsingiz emas.",
      },
      {
        h: "Buni yana kim ko'radi",
        p: "Ochiq: loyiha nomi, havola, o'rin, stavka yoki ovozlar soni, o'tishlar soni, tasdiq nishoni. Shaxsiy: ovoz balansi, cheklar va sozlamalar.",
      },
      {
        h: 'Huquqlaringiz',
        p: "Botdan ma'lumotlaringiz nusxasini yoki o'chirishni so'rang. O'chirish akkauntni olib tashlaydi va loyihalarni yashiradi; hisob-kitob yozuvlari shaxssizlantirilgan holda qoladi.",
      },
    ],
  },
  bot: {
    icon: 'send',
    title: 'Telegram bot',
    lead: "Bot — bildirishnomalar kanali va eng tez kirish yo'li. Mini-ilova va sayt bitta akkauntni ko'rsatadi.",
    facts: [
      ['Manzil', '@bidwar_bot'],
      ['Bildirishnomalar', "Hujumlar · o'rinlar · topshiriqlar"],
      ['Kirish', 'Telegram'],
    ],
    sections: [
      {
        h: 'Nima yuboradi',
        p: "Sizga hujum qilishdi, birinchi o'rinni yo'qotdingiz, loyihangizga ovoz berishdi, taklif qilganingiz mukofot keltirdi. Har bir turi «Profil → Bildirishnomalar» bo'limida o'chiriladi.",
      },
      {
        h: 'Buyruqlar',
        p: "/top — o'rinlaringiz · /votes — ovoz balansi · /raise — stavkani ko'tarish · /tasks — bugungi topshiriqlar · /support — qo'llab-quvvatlashga yozish.",
      },
      {
        h: 'Mini-ilova yoki sayt',
        p: "Akkaunt bitta, qoidalar bitta. Mini-ilova Telegram ichida ochiladi, sayt esa kengroq jadvallar va to'liq loyiha sahifalarini qo'shadi.",
      },
    ],
  },
};
