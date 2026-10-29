import type { Category } from "../types";

/**
 * The Words, authored once. Both spellings are written by hand: the Plain
 * Spelling is the standard full spelling (כתיב מלא) and is never the Voweled
 * Spelling with its marks stripped (עַגְבָנִיָּה vs עגבנייה).
 *
 * `id` is the Word's stable identity: `word-` plus an English slug. It names
 * the Word's Voice Clip and its Picture (`public/pictures/<id>.svg`), so never
 * rename one.
 *
 * `emoji` is the Twemoji the Picture file was copied from (`npm run pictures`).
 * The app itself draws only the file.
 *
 * Every one of the 22 letters starts at least two Words (checked by the
 * Content Bank tests).
 */
export interface WordData {
  readonly id: string;
  readonly voweled: string;
  readonly plain: string;
  readonly category: Category;
  readonly emoji: string;
  readonly pronunciation?: string;
  readonly soundsLike?: string;
}

export const WORDS: readonly WordData[] = [
  // Fruits
  { id: "word-watermelon", voweled: "אֲבַטִּיחַ", plain: "אבטיח", category: "fruits", emoji: "🍉" },
  { id: "word-pear", voweled: "אַגָּס", plain: "אגס", category: "fruits", emoji: "🍐" },
  { id: "word-pineapple", voweled: "אֲנָנָס", plain: "אננס", category: "fruits", emoji: "🍍" },
  { id: "word-banana", voweled: "בָּנָנָה", plain: "בננה", category: "fruits", emoji: "🍌" },
  { id: "word-cherry", voweled: "דֻּבְדְּבָן", plain: "דובדבן", category: "fruits", emoji: "🍒" },
  { id: "word-olive", voweled: "זַיִת", plain: "זית", category: "fruits", emoji: "🫒" },
  { id: "word-lemon", voweled: "לִימוֹן", plain: "לימון", category: "fruits", emoji: "🍋" },
  { id: "word-melon", voweled: "מֶלוֹן", plain: "מלון", category: "fruits", emoji: "🍈" },
  { id: "word-mango", voweled: "מַנְגּוֹ", plain: "מנגו", category: "fruits", emoji: "🥭" },
  { id: "word-grapes", voweled: "עֲנָבִים", plain: "ענבים", category: "fruits", emoji: "🍇" },
  { id: "word-coconut", voweled: "קוֹקוֹס", plain: "קוקוס", category: "fruits", emoji: "🥥" },
  { id: "word-kiwi", voweled: "קִיוִי", plain: "קיווי", category: "fruits", emoji: "🥝" },
  { id: "word-strawberry", voweled: "תּוּת", plain: "תות", category: "fruits", emoji: "🍓" },
  { id: "word-apple", voweled: "תַּפּוּחַ", plain: "תפוח", category: "fruits", emoji: "🍎" },
  { id: "word-orange", voweled: "תַּפּוּז", plain: "תפוז", category: "fruits", emoji: "🍊" },

  // Vegetables
  { id: "word-peas", voweled: "אֲפוּנָה", plain: "אפונה", category: "vegetables", emoji: "🫛" },
  { id: "word-broccoli", voweled: "בְּרוֹקוֹלִי", plain: "ברוקולי", category: "vegetables", emoji: "🥦" },
  { id: "word-sweet-potato", voweled: "בָּטָטָה", plain: "בטטה", category: "vegetables", emoji: "🍠" },
  { id: "word-onion", voweled: "בָּצָל", plain: "בצל", category: "vegetables", emoji: "🧅" },
  { id: "word-carrot", voweled: "גֶּזֶר", plain: "גזר", category: "vegetables", emoji: "🥕" },
  { id: "word-lettuce", voweled: "חַסָּה", plain: "חסה", category: "vegetables", emoji: "🥬" },
  { id: "word-eggplant", voweled: "חָצִיל", plain: "חציל", category: "vegetables", emoji: "🍆" },
  { id: "word-cucumber", voweled: "מְלָפְפוֹן", plain: "מלפפון", category: "vegetables", emoji: "🥒" },
  { id: "word-tomato", voweled: "עַגְבָנִיָּה", plain: "עגבנייה", category: "vegetables", emoji: "🍅" },
  { id: "word-mushroom", voweled: "פִּטְרִיָּה", plain: "פטרייה", category: "vegetables", emoji: "🍄" },
  { id: "word-pepper", voweled: "פִּלְפֵּל", plain: "פלפל", category: "vegetables", emoji: "🫑" },
  { id: "word-garlic", voweled: "שׁוּם", plain: "שום", category: "vegetables", emoji: "🧄" },
  { id: "word-corn", voweled: "תִּירָס", plain: "תירס", category: "vegetables", emoji: "🌽" },

  // Animals
  { id: "word-lion", voweled: "אַרְיֵה", plain: "אריה", category: "animals", emoji: "🦁" },
  { id: "word-rabbit", voweled: "אַרְנָב", plain: "ארנב", category: "animals", emoji: "🐇" },
  { id: "word-duck", voweled: "בַּרְוָז", plain: "ברווז", category: "animals", emoji: "🦆" },
  { id: "word-camel", voweled: "גָּמָל", plain: "גמל", category: "animals", emoji: "🐪" },
  { id: "word-bear", voweled: "דֹּב", plain: "דוב", category: "animals", emoji: "🐻" },
  { id: "word-fish", voweled: "דָּג", plain: "דג", category: "animals", emoji: "🐟" },
  { id: "word-hippo", voweled: "הִיפּוֹפּוֹטָם", plain: "היפופוטם", category: "animals", emoji: "🦛" },
  { id: "word-wolf", voweled: "זְאֵב", plain: "זאב", category: "animals", emoji: "🐺" },
  { id: "word-zebra", voweled: "זֶבְּרָה", plain: "זברה", category: "animals", emoji: "🦓" },
  { id: "word-cat", voweled: "חָתוּל", plain: "חתול", category: "animals", emoji: "🐈" },
  { id: "word-peacock", voweled: "טַוָּס", plain: "טווס", category: "animals", emoji: "🦚" },
  { id: "word-dove", voweled: "יוֹנָה", plain: "יונה", category: "animals", emoji: "🕊️" },
  { id: "word-owl", voweled: "יַנְשׁוּף", plain: "ינשוף", category: "animals", emoji: "🦉" },
  { id: "word-dog", voweled: "כֶּלֶב", plain: "כלב", category: "animals", emoji: "🐕" },
  { id: "word-lizard", voweled: "לְטָאָה", plain: "לטאה", category: "animals", emoji: "🦎" },
  { id: "word-snake", voweled: "נָחָשׁ", plain: "נחש", category: "animals", emoji: "🐍" },
  { id: "word-tiger", voweled: "נָמֵר", plain: "נמר", category: "animals", emoji: "🐅" },
  { id: "word-squirrel", voweled: "סְנָאִי", plain: "סנאי", category: "animals", emoji: "🐿️" },
  { id: "word-horse", voweled: "סוּס", plain: "סוס", category: "animals", emoji: "🐎" },
  { id: "word-mouse", voweled: "עַכְבָּר", plain: "עכבר", category: "animals", emoji: "🐁" },
  { id: "word-elephant", voweled: "פִּיל", plain: "פיל", category: "animals", emoji: "🐘" },
  { id: "word-cow", voweled: "פָּרָה", plain: "פרה", category: "animals", emoji: "🐄" },
  { id: "word-butterfly", voweled: "פַּרְפַּר", plain: "פרפר", category: "animals", emoji: "🦋" },
  { id: "word-turtle", voweled: "צָב", plain: "צב", category: "animals", emoji: "🐢" },
  { id: "word-bird", voweled: "צִפּוֹר", plain: "ציפור", category: "animals", emoji: "🐦" },
  { id: "word-frog", voweled: "צְפַרְדֵּעַ", plain: "צפרדע", category: "animals", emoji: "🐸" },
  { id: "word-monkey", voweled: "קוֹף", plain: "קוף", category: "animals", emoji: "🐒" },
  { id: "word-hedgehog", voweled: "קִפּוֹד", plain: "קיפוד", category: "animals", emoji: "🦔" },
  { id: "word-snail", voweled: "שַׁבְּלוּל", plain: "שבלול", category: "animals", emoji: "🐌" },
  { id: "word-fox", voweled: "שׁוּעָל", plain: "שועל", category: "animals", emoji: "🦊" },
  { id: "word-rooster", voweled: "תַּרְנְגוֹל", plain: "תרנגול", category: "animals", emoji: "🐓" },

  // Home objects
  { id: "word-socks", voweled: "גַּרְבַּיִם", plain: "גרביים", category: "home-objects", emoji: "🧦" },
  { id: "word-door", voweled: "דֶּלֶת", plain: "דלת", category: "home-objects", emoji: "🚪" },
  { id: "word-hook", voweled: "וָו", plain: "וו", category: "home-objects", emoji: "🪝" },
  { id: "word-window", voweled: "חַלּוֹן", plain: "חלון", category: "home-objects", emoji: "🪟" },
  { id: "word-television", voweled: "טֶלֶוִיזְיָה", plain: "טלוויזיה", category: "home-objects", emoji: "📺" },
  { id: "word-telephone", voweled: "טֶלֶפוֹן", plain: "טלפון", category: "home-objects", emoji: "☎️" },
  { id: "word-ball", voweled: "כַּדּוּר", plain: "כדור", category: "home-objects", emoji: "⚽" },
  { id: "word-chair", voweled: "כִּסֵּא", plain: "כיסא", category: "home-objects", emoji: "🪑" },
  { id: "word-spoon", voweled: "כַּף", plain: "כף", category: "home-objects", emoji: "🥄" },
  { id: "word-bed", voweled: "מִטָּה", plain: "מיטה", category: "home-objects", emoji: "🛏️" },
  { id: "word-key", voweled: "מַפְתֵּחַ", plain: "מפתח", category: "home-objects", emoji: "🔑" },
  { id: "word-shoe", voweled: "נַעַל", plain: "נעל", category: "home-objects", emoji: "👟" },
  { id: "word-candle", voweled: "נֵר", plain: "נר", category: "home-objects", emoji: "🕯️" },
  { id: "word-soap", voweled: "סַבּוֹן", plain: "סבון", category: "home-objects", emoji: "🧼" },
  { id: "word-sofa", voweled: "סַפָּה", plain: "ספה", category: "home-objects", emoji: "🛋️" },
  { id: "word-kite", voweled: "עֲפִיפוֹן", plain: "עפיפון", category: "home-objects", emoji: "🪁" },
  { id: "word-plate", voweled: "צַלַּחַת", plain: "צלחת", category: "home-objects", emoji: "🍽️" },
  { id: "word-radio", voweled: "רַדְיוֹ", plain: "רדיו", category: "home-objects", emoji: "📻" },
  { id: "word-clock", voweled: "שָׁעוֹן", plain: "שעון", category: "home-objects", emoji: "⏰" },

  // Other: Words for hard letters that fit none of the four Categories
  { id: "word-helicopter", voweled: "הֶלִיקוֹפְּטֶר", plain: "הליקופטר", category: "other", emoji: "🚁" },
  { id: "word-hamburger", voweled: "הַמְבּוּרְגֶּר", plain: "המבורגר", category: "other", emoji: "🍔" },
  { id: "word-waffle", voweled: "וַפֶל", plain: "ופל", category: "other", emoji: "🧇" },
  { id: "word-rose", voweled: "וֶרֶד", plain: "ורד", category: "other", emoji: "🌹" },
  { id: "word-train", voweled: "רַכֶּבֶת", plain: "רכבת", category: "other", emoji: "🚂" },
  { id: "word-leg", voweled: "רֶגֶל", plain: "רגל", category: "other", emoji: "🦵" },
];
