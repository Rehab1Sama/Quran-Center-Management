import { Router, type IRouter } from "express";
import { db, reviewPlansTable, recordsTable, studentsTable, circlesTable, usersTable, tracksTable, planNotificationsTable } from "@workspace/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { authenticate } from "../middlewares/authenticate";
import type { PlanDayEntry, PlanTheme, PlanSnapshot } from "@workspace/db";

const router: IRouter = Router();

// Medina mushaf (مجمع الملك فهد، 604 صفحة) — صفحة بداية كل سورة
const SURAH_START_PAGE = [
  1, 2, 50, 77, 106, 128, 151, 177, 187, 208,          // 1-10
  221, 235, 249, 255, 262, 267, 282, 293, 305, 312,     // 11-20
  322, 332, 342, 350, 359, 367, 377, 385, 396, 404,     // 21-30
  411, 415, 418, 428, 434, 440, 446, 453, 458, 467,     // 31-40
  477, 483, 489, 496, 499, 502, 507, 511, 515, 518,     // 41-50
  520, 523, 526, 528, 531, 534, 537, 542, 545, 549,     // 51-60
  551, 553, 554, 556, 558, 560, 562, 564, 566, 568,     // 61-70
  570, 572, 574, 575, 577, 578, 580, 582, 583, 585,     // 71-80
  586, 587, 588, 589, 590, 591, 591, 592, 593, 594,     // 81-90
  595, 595, 596, 596, 597, 597, 598, 598, 599, 599,     // 91-100
  600, 600, 601, 601, 601, 602, 602, 602, 603, 603,     // 101-110
  603, 604, 604, 604,                                    // 111-114
];

const SURAHS = [
  { n: 1, name: "الفاتحة", ayahs: 7 },{ n: 2, name: "البقرة", ayahs: 286 },{ n: 3, name: "آل عمران", ayahs: 200 },
  { n: 4, name: "النساء", ayahs: 176 },{ n: 5, name: "المائدة", ayahs: 120 },{ n: 6, name: "الأنعام", ayahs: 165 },
  { n: 7, name: "الأعراف", ayahs: 206 },{ n: 8, name: "الأنفال", ayahs: 75 },{ n: 9, name: "التوبة", ayahs: 129 },
  { n: 10, name: "يونس", ayahs: 109 },{ n: 11, name: "هود", ayahs: 123 },{ n: 12, name: "يوسف", ayahs: 111 },
  { n: 13, name: "الرعد", ayahs: 43 },{ n: 14, name: "إبراهيم", ayahs: 52 },{ n: 15, name: "الحجر", ayahs: 99 },
  { n: 16, name: "النحل", ayahs: 128 },{ n: 17, name: "الإسراء", ayahs: 111 },{ n: 18, name: "الكهف", ayahs: 110 },
  { n: 19, name: "مريم", ayahs: 98 },{ n: 20, name: "طه", ayahs: 135 },{ n: 21, name: "الأنبياء", ayahs: 112 },
  { n: 22, name: "الحج", ayahs: 78 },{ n: 23, name: "المؤمنون", ayahs: 118 },{ n: 24, name: "النور", ayahs: 64 },
  { n: 25, name: "الفرقان", ayahs: 77 },{ n: 26, name: "الشعراء", ayahs: 227 },{ n: 27, name: "النمل", ayahs: 93 },
  { n: 28, name: "القصص", ayahs: 88 },{ n: 29, name: "العنكبوت", ayahs: 69 },{ n: 30, name: "الروم", ayahs: 60 },
  { n: 31, name: "لقمان", ayahs: 34 },{ n: 32, name: "السجدة", ayahs: 30 },{ n: 33, name: "الأحزاب", ayahs: 73 },
  { n: 34, name: "سبأ", ayahs: 54 },{ n: 35, name: "فاطر", ayahs: 45 },{ n: 36, name: "يس", ayahs: 83 },
  { n: 37, name: "الصافات", ayahs: 182 },{ n: 38, name: "ص", ayahs: 88 },{ n: 39, name: "الزمر", ayahs: 75 },
  { n: 40, name: "غافر", ayahs: 85 },{ n: 41, name: "فصلت", ayahs: 54 },{ n: 42, name: "الشورى", ayahs: 53 },
  { n: 43, name: "الزخرف", ayahs: 89 },{ n: 44, name: "الدخان", ayahs: 59 },{ n: 45, name: "الجاثية", ayahs: 37 },
  { n: 46, name: "الأحقاف", ayahs: 35 },{ n: 47, name: "محمد", ayahs: 38 },{ n: 48, name: "الفتح", ayahs: 29 },
  { n: 49, name: "الحجرات", ayahs: 18 },{ n: 50, name: "ق", ayahs: 45 },{ n: 51, name: "الذاريات", ayahs: 60 },
  { n: 52, name: "الطور", ayahs: 49 },{ n: 53, name: "النجم", ayahs: 62 },{ n: 54, name: "القمر", ayahs: 55 },
  { n: 55, name: "الرحمن", ayahs: 78 },{ n: 56, name: "الواقعة", ayahs: 96 },{ n: 57, name: "الحديد", ayahs: 29 },
  { n: 58, name: "المجادلة", ayahs: 22 },{ n: 59, name: "الحشر", ayahs: 24 },{ n: 60, name: "الممتحنة", ayahs: 13 },
  { n: 61, name: "الصف", ayahs: 14 },{ n: 62, name: "الجمعة", ayahs: 11 },{ n: 63, name: "المنافقون", ayahs: 11 },
  { n: 64, name: "التغابن", ayahs: 18 },{ n: 65, name: "الطلاق", ayahs: 12 },{ n: 66, name: "التحريم", ayahs: 12 },
  { n: 67, name: "الملك", ayahs: 30 },{ n: 68, name: "القلم", ayahs: 52 },{ n: 69, name: "الحاقة", ayahs: 52 },
  { n: 70, name: "المعارج", ayahs: 44 },{ n: 71, name: "نوح", ayahs: 28 },{ n: 72, name: "الجن", ayahs: 28 },
  { n: 73, name: "المزمل", ayahs: 20 },{ n: 74, name: "المدثر", ayahs: 56 },{ n: 75, name: "القيامة", ayahs: 40 },
  { n: 76, name: "الإنسان", ayahs: 31 },{ n: 77, name: "المرسلات", ayahs: 50 },{ n: 78, name: "النبأ", ayahs: 40 },
  { n: 79, name: "النازعات", ayahs: 46 },{ n: 80, name: "عبس", ayahs: 42 },{ n: 81, name: "التكوير", ayahs: 29 },
  { n: 82, name: "الانفطار", ayahs: 19 },{ n: 83, name: "المطففين", ayahs: 36 },{ n: 84, name: "الانشقاق", ayahs: 25 },
  { n: 85, name: "البروج", ayahs: 22 },{ n: 86, name: "الطارق", ayahs: 17 },{ n: 87, name: "الأعلى", ayahs: 19 },
  { n: 88, name: "الغاشية", ayahs: 26 },{ n: 89, name: "الفجر", ayahs: 30 },{ n: 90, name: "البلد", ayahs: 20 },
  { n: 91, name: "الشمس", ayahs: 15 },{ n: 92, name: "الليل", ayahs: 21 },{ n: 93, name: "الضحى", ayahs: 11 },
  { n: 94, name: "الشرح", ayahs: 8 },{ n: 95, name: "التين", ayahs: 8 },{ n: 96, name: "العلق", ayahs: 19 },
  { n: 97, name: "القدر", ayahs: 5 },{ n: 98, name: "البينة", ayahs: 8 },{ n: 99, name: "الزلزلة", ayahs: 8 },
  { n: 100, name: "العاديات", ayahs: 11 },{ n: 101, name: "القارعة", ayahs: 11 },{ n: 102, name: "التكاثر", ayahs: 8 },
  { n: 103, name: "العصر", ayahs: 3 },{ n: 104, name: "الهمزة", ayahs: 9 },{ n: 105, name: "الفيل", ayahs: 5 },
  { n: 106, name: "قريش", ayahs: 4 },{ n: 107, name: "الماعون", ayahs: 7 },{ n: 108, name: "الكوثر", ayahs: 3 },
  { n: 109, name: "الكافرون", ayahs: 6 },{ n: 110, name: "النصر", ayahs: 3 },{ n: 111, name: "المسد", ayahs: 5 },
  { n: 112, name: "الإخلاص", ayahs: 4 },{ n: 113, name: "الفلق", ayahs: 5 },{ n: 114, name: "الناس", ayahs: 6 },
];

function absAyahByNum(surahNum: number, ayah: number): number {
  let total = 0;
  for (let i = 0; i < surahNum - 1; i++) total += SURAHS[i].ayahs;
  return total + ayah;
}

function absAyah(surahName: string, ayah: number): number {
  const idx = SURAHS.findIndex(s => s.name === surahName);
  if (idx === -1) return 0;
  let total = 0;
  for (let i = 0; i < idx; i++) total += SURAHS[i].ayahs;
  return total + ayah;
}

// مصحف المدينة المنورة — حدود الأوجه الدقيقة
// كل إدخال: [رقم السورة، أول آية في هذا الوجه، رقم الوجه (0.5 = نصف صفحة)]
const MUSHAF_PAGES: [number, number, number][] = [[1,1,1],[1,4,1.5],[2,1,2],[2,3,2.5],[2,6,3],[2,11,3.5],[2,17,4],[2,21,4.5],[2,25,5],[2,27,5.5],[2,30,6],[2,34,6.5],[2,38,7],[2,43,7.5],[2,49,8],[2,53,8.5],[2,58,9],[2,60,9.5],[2,62,10],[2,66,10.5],[2,70,11],[2,73,11.5],[2,77,12],[2,80,12.5],[2,84,13],[2,86,13.5],[2,89,14],[2,91,14.5],[2,94,15],[2,98,15.5],[2,102,16],[2,104,16.5],[2,106,17],[2,109,17.5],[2,113,18],[2,116,18.5],[2,120,19],[2,123,19.5],[2,127,20],[2,131,20.5],[2,135,21],[2,138,21.5],[2,142,22],[2,144,22.5],[2,146,23],[2,150,23.5],[2,154,24],[2,159,24.5],[2,164,25],[2,167,25.5],[2,170,26],[2,173,26.5],[2,177,27],[2,179,27.5],[2,182,28],[2,184,28.5],[2,187,29],[2,189,29.5],[2,191,30],[2,194,30.5],[2,197,31],[2,200,31.5],[2,203,32],[2,207,32.5],[2,211,33],[2,213,33.5],[2,216,34],[2,218,34.5],[2,220,35],[2,222,35.5],[2,225,36],[2,228,36.5],[2,231,37],[2,232,37.5],[2,234,38],[2,236,38.5],[2,238,39],[2,242,39.5],[2,246,40],[2,247,40.5],[2,249,41],[2,251,41.5],[2,253,42],[2,255,42.5],[2,257,43],[2,258,43.5],[2,260,44],[2,262,44.5],[2,265,45],[2,267,45.5],[2,270,46],[2,272,46.5],[2,275,47],[2,278,47.5],[2,282,48],[2,283,49],[2,285,49.5],[3,1,50],[3,5,50.5],[3,10,51],[3,13,51.5],[3,16,52],[3,19,52.5],[3,23,53],[3,26,53.5],[3,30,54],[3,34,54.5],[3,38,55],[3,42,55.5],[3,46,56],[3,49,56.5],[3,53,57],[3,57,57.5],[3,62,58],[3,66,58.5],[3,71,59],[3,74,59.5],[3,78,60],[3,81,60.5],[3,84,61],[3,88,61.5],[3,92,62],[3,96,62.5],[3,101,63],[3,105,63.5],[3,109,64],[3,112,64.5],[3,116,65],[3,119,65.5],[3,122,66],[3,127,66.5],[3,133,67],[3,137,67.5],[3,141,68],[3,145,68.5],[3,149,69],[3,151,69.5],[3,154,70],[3,156,70.5],[3,158,71],[3,162,71.5],[3,166,72],[3,170,72.5],[3,174,73],[3,177,73.5],[3,181,74],[3,184,74.5],[3,187,75],[3,191,75.5],[3,195,76],[3,198,76.5],[4,1,77],[4,4,77.5],[4,7,78],[4,9,78.5],[4,12,79],[4,13,79.5],[4,15,80],[4,17,80.5],[4,20,81],[4,22,81.5],[4,24,82],[4,25,82.5],[4,27,83],[4,30,83.5],[4,34,84],[4,36,84.5],[4,38,85],[4,41,85.5],[4,45,86],[4,48,86.5],[4,52,87],[4,55,87.5],[4,58,88],[4,61,88.5],[4,65,89],[4,69,89.5],[4,72,90],[4,77,90.5],[4,82,91],[4,86,91.5],[4,89,92],[4,92,92.5],[4,95,93],[4,98,93.5],[4,102,94],[4,106,94.5],[4,110,95],[4,114,95.5],[4,120,96],[4,125,96.5],[4,130,97],[4,135,97.5],[4,141,98],[4,148,98.5],[4,155,99],[4,163,99.5],[4,171,100],[4,176,100.5],[5,1,101],[5,4,101.5],[5,7,102],[5,11,102.5],[5,15,103],[5,19,103.5],[5,24,104],[5,28,104.5],[5,32,105],[5,35,105.5],[5,38,106],[5,42,106.5],[5,46,107],[5,50,107.5],[5,54,108],[5,58,108.5],[5,62,109],[5,65,109.5],[5,68,110],[5,71,110.5],[5,75,111],[5,79,111.5],[5,83,112],[5,87,112.5],[5,91,113],[5,95,113.5],[5,99,114],[5,104,114.5],[5,109,115],[5,114,115.5],[5,120,116],[6,1,116.5],[6,6,117],[6,11,117.5],[6,16,118],[6,20,118.5],[6,24,119],[6,28,119.5],[6,32,120],[6,36,120.5],[6,41,121],[6,45,121.5],[6,49,122],[6,53,122.5],[6,57,123],[6,62,123.5],[6,67,124],[6,71,124.5],[6,74,125],[6,78,125.5],[6,83,126],[6,87,126.5],[6,92,127],[6,95,127.5],[6,99,128],[6,102,128.5],[6,106,129],[6,110,129.5],[6,114,130],[6,119,130.5],[6,124,131],[6,128,131.5],[6,132,132],[6,136,132.5],[6,140,133],[6,143,133.5],[6,147,134],[6,151,134.5],[6,155,135],[6,158,135.5],[6,162,136],[6,165,136.5],[7,1,137],[7,5,137.5],[7,10,138],[7,14,138.5],[7,18,139],[7,22,139.5],[7,27,140],[7,31,140.5],[7,36,141],[7,41,141.5],[7,46,142],[7,51,142.5],[7,56,143],[7,61,143.5],[7,66,144],[7,71,144.5],[7,75,145],[7,79,145.5],[7,83,146],[7,88,146.5],[7,93,147],[7,97,147.5],[7,101,148],[7,105,148.5],[7,109,149],[7,113,149.5],[7,117,150],[7,122,150.5],[7,127,151],[7,131,151.5],[7,135,152],[7,140,152.5],[7,145,153],[7,150,153.5],[7,155,154],[7,159,154.5],[7,164,155],[7,169,155.5],[7,173,156],[7,177,156.5],[7,181,157],[7,185,157.5],[7,189,158],[7,193,158.5],[7,196,159],[7,200,159.5],[7,204,160],[7,206,160.5],[8,1,161],[8,5,161.5],[8,9,162],[8,13,162.5],[8,17,163],[8,21,163.5],[8,26,164],[8,30,164.5],[8,34,165],[8,38,165.5],[8,42,166],[8,46,166.5],[8,50,167],[8,54,167.5],[8,59,168],[8,63,168.5],[8,68,169],[8,72,169.5],[8,75,170],[9,1,170.5],[9,5,171],[9,9,171.5],[9,13,172],[9,17,172.5],[9,21,173],[9,25,173.5],[9,29,174],[9,33,174.5],[9,37,175],[9,41,175.5],[9,46,176],[9,51,176.5],[9,56,177],[9,60,177.5],[9,64,178],[9,68,178.5],[9,73,179],[9,78,179.5],[9,83,180],[9,87,180.5],[9,92,181],[9,97,181.5],[9,102,182],[9,107,182.5],[9,111,183],[9,115,183.5],[9,119,184],[9,123,184.5],[9,127,185],[10,1,185.5],[10,6,186],[10,11,186.5],[10,16,187],[10,21,187.5],[10,26,188],[10,31,188.5],[10,36,189],[10,41,189.5],[10,46,190],[10,51,190.5],[10,57,191],[10,62,191.5],[10,67,192],[10,72,192.5],[10,78,193],[10,83,193.5],[10,89,194],[10,94,194.5],[10,99,195],[10,104,195.5],[10,109,196],[11,1,196.5],[11,6,197],[11,11,197.5],[11,17,198],[11,23,198.5],[11,29,199],[11,35,199.5],[11,41,200],[11,47,200.5],[11,54,201],[11,60,201.5],[11,66,202],[11,72,202.5],[11,78,203],[11,84,203.5],[11,91,204],[11,98,204.5],[11,105,205],[11,111,205.5],[11,116,206],[11,120,206.5],[11,123,207],[12,1,207.5],[12,6,208],[12,11,208.5],[12,16,209],[12,21,209.5],[12,27,210],[12,33,210.5],[12,39,211],[12,45,211.5],[12,51,212],[12,57,212.5],[12,63,213],[12,69,213.5],[12,75,214],[12,81,214.5],[12,87,215],[12,93,215.5],[12,99,216],[12,105,216.5],[12,111,217],[13,1,217.5],[13,5,218],[13,9,218.5],[13,13,219],[13,17,219.5],[13,20,220],[13,24,220.5],[13,28,221],[13,32,221.5],[13,36,222],[13,40,222.5],[13,43,223],[14,1,223.5],[14,5,224],[14,9,224.5],[14,13,225],[14,17,225.5],[14,22,226],[14,28,226.5],[14,33,227],[14,37,227.5],[14,41,228],[14,46,228.5],[14,50,229],[14,52,229.5],[15,1,230],[15,6,230.5],[15,11,231],[15,16,231.5],[15,22,232],[15,27,232.5],[15,33,233],[15,39,233.5],[15,45,234],[15,51,234.5],[15,57,235],[15,63,235.5],[15,70,236],[15,76,236.5],[15,83,237],[15,89,237.5],[15,95,238],[15,99,238.5],[16,1,239],[16,7,239.5],[16,13,240],[16,19,240.5],[16,25,241],[16,31,241.5],[16,37,242],[16,43,242.5],[16,50,243],[16,57,243.5],[16,64,244],[16,71,244.5],[16,78,245],[16,84,245.5],[16,91,246],[16,97,246.5],[16,103,247],[16,109,247.5],[16,114,248],[16,120,248.5],[16,126,249],[16,128,249.5],[17,1,250],[17,7,250.5],[17,13,251],[17,19,251.5],[17,25,252],[17,32,252.5],[17,39,253],[17,46,253.5],[17,52,254],[17,58,254.5],[17,65,255],[17,71,255.5],[17,78,256],[17,84,256.5],[17,90,257],[17,96,257.5],[17,102,258],[17,107,258.5],[17,111,259],[18,1,259.5],[18,6,260],[18,12,260.5],[18,18,261],[18,24,261.5],[18,30,262],[18,36,262.5],[18,42,263],[18,48,263.5],[18,54,264],[18,60,264.5],[18,66,265],[18,72,265.5],[18,78,266],[18,84,266.5],[18,90,267],[18,96,267.5],[18,102,268],[18,108,268.5],[18,110,269],[19,1,269.5],[19,7,270],[19,13,270.5],[19,19,271],[19,26,271.5],[19,33,272],[19,41,272.5],[19,49,273],[19,57,273.5],[19,65,274],[19,73,274.5],[19,80,275],[19,87,275.5],[19,93,276],[19,98,276.5],[20,1,277],[20,7,277.5],[20,14,278],[20,21,278.5],[20,29,279],[20,38,279.5],[20,46,280],[20,55,280.5],[20,64,281],[20,73,281.5],[20,83,282],[20,92,282.5],[20,101,283],[20,110,283.5],[20,119,284],[20,128,284.5],[20,135,285],[21,1,285.5],[21,7,286],[21,14,286.5],[21,21,287],[21,28,287.5],[21,36,288],[21,45,288.5],[21,52,289],[21,60,289.5],[21,69,290],[21,78,290.5],[21,86,291],[21,94,291.5],[21,101,292],[21,108,292.5],[21,112,293],[22,1,293.5],[22,6,294],[22,12,294.5],[22,18,295],[22,24,295.5],[22,31,296],[22,38,296.5],[22,45,297],[22,52,297.5],[22,59,298],[22,65,298.5],[22,72,299],[22,77,299.5],[22,78,300],[23,1,300.5],[23,7,301],[23,13,301.5],[23,19,302],[23,26,302.5],[23,33,303],[23,41,303.5],[23,50,304],[23,60,304.5],[23,70,305],[23,80,305.5],[23,90,306],[23,100,306.5],[23,109,307],[23,116,307.5],[23,118,308],[24,1,308.5],[24,7,309],[24,13,309.5],[24,19,310],[24,25,310.5],[24,32,311],[24,38,311.5],[24,44,312],[24,50,312.5],[24,55,313],[24,59,313.5],[24,62,314],[24,64,314.5],[25,1,315],[25,7,315.5],[25,14,316],[25,20,316.5],[25,26,317],[25,32,317.5],[25,38,318],[25,44,318.5],[25,50,319],[25,57,319.5],[25,64,320],[25,70,320.5],[25,74,321],[25,77,321.5],[26,1,322],[26,7,322.5],[26,14,323],[26,21,323.5],[26,29,324],[26,37,324.5],[26,45,325],[26,53,325.5],[26,62,326],[26,71,326.5],[26,80,327],[26,89,327.5],[26,99,328],[26,109,328.5],[26,119,329],[26,129,329.5],[26,139,330],[26,149,330.5],[26,160,331],[26,171,331.5],[26,182,332],[26,192,332.5],[26,202,333],[26,213,333.5],[26,222,334],[26,227,334.5],[27,1,335],[27,7,335.5],[27,14,336],[27,20,336.5],[27,26,337],[27,32,337.5],[27,38,338],[27,44,338.5],[27,50,339],[27,56,339.5],[27,62,340],[27,68,340.5],[27,74,341],[27,80,341.5],[27,87,342],[27,90,342.5],[27,93,343],[28,1,343.5],[28,7,344],[28,14,344.5],[28,21,345],[28,28,345.5],[28,35,346],[28,41,346.5],[28,48,347],[28,55,347.5],[28,62,348],[28,69,348.5],[28,76,349],[28,83,349.5],[28,88,350],[29,1,350.5],[29,7,351],[29,13,351.5],[29,19,352],[29,26,352.5],[29,32,353],[29,38,353.5],[29,45,354],[29,51,354.5],[29,57,355],[29,62,355.5],[29,65,356],[29,69,356.5],[30,1,357],[30,7,357.5],[30,14,358],[30,21,358.5],[30,28,359],[30,34,359.5],[30,41,360],[30,48,360.5],[30,54,361],[30,58,361.5],[30,60,362],[31,1,362.5],[31,5,363],[31,9,363.5],[31,14,364],[31,19,364.5],[31,23,365],[31,27,365.5],[31,30,366],[31,34,366.5],[32,1,367],[32,6,367.5],[32,12,368],[32,18,368.5],[32,23,369],[32,27,369.5],[32,30,370],[33,1,370.5],[33,6,371],[33,11,371.5],[33,16,372],[33,22,372.5],[33,27,373],[33,32,373.5],[33,37,374],[33,43,374.5],[33,48,375],[33,53,375.5],[33,59,376],[33,64,376.5],[33,69,377],[33,73,377.5],[34,1,378],[34,6,378.5],[34,11,379],[34,16,379.5],[34,21,380],[34,26,380.5],[34,31,381],[34,36,381.5],[34,41,382],[34,46,382.5],[34,51,383],[34,54,383.5],[35,1,384],[35,5,384.5],[35,9,385],[35,14,385.5],[35,19,386],[35,24,386.5],[35,29,387],[35,34,387.5],[35,39,388],[35,44,388.5],[35,45,389],[36,1,389.5],[36,7,390],[36,13,390.5],[36,19,391],[36,25,391.5],[36,31,392],[36,37,392.5],[36,43,393],[36,49,393.5],[36,55,394],[36,61,394.5],[36,67,395],[36,73,395.5],[36,79,396],[36,83,396.5],[37,1,397],[37,7,397.5],[37,14,398],[37,21,398.5],[37,29,399],[37,37,399.5],[37,45,400],[37,54,400.5],[37,63,401],[37,73,401.5],[37,83,402],[37,93,402.5],[37,103,403],[37,114,403.5],[37,125,404],[37,136,404.5],[37,148,405],[37,160,405.5],[37,171,406],[37,182,406.5],[38,1,407],[38,7,407.5],[38,14,408],[38,21,408.5],[38,28,409],[38,35,409.5],[38,42,410],[38,49,410.5],[38,56,411],[38,63,411.5],[38,70,412],[38,77,412.5],[38,83,413],[38,86,413.5],[38,88,414],[39,1,414.5],[39,6,415],[39,11,415.5],[39,16,416],[39,22,416.5],[39,27,417],[39,32,417.5],[39,37,418],[39,43,418.5],[39,48,419],[39,53,419.5],[39,59,420],[39,64,420.5],[39,69,421],[39,74,421.5],[39,75,422],[40,1,422.5],[40,6,423],[40,11,423.5],[40,16,424],[40,21,424.5],[40,26,425],[40,31,425.5],[40,37,426],[40,43,426.5],[40,49,427],[40,55,427.5],[40,61,428],[40,67,428.5],[40,73,429],[40,79,429.5],[40,85,430],[41,1,430.5],[41,6,431],[41,12,431.5],[41,17,432],[41,22,432.5],[41,28,433],[41,34,433.5],[41,40,434],[41,46,434.5],[41,51,435],[41,54,435.5],[42,1,436],[42,6,436.5],[42,11,437],[42,17,437.5],[42,23,438],[42,29,438.5],[42,36,439],[42,42,439.5],[42,47,440],[42,51,440.5],[42,53,441],[43,1,441.5],[43,6,442],[43,12,442.5],[43,18,443],[43,24,443.5],[43,30,444],[43,36,444.5],[43,42,445],[43,48,445.5],[43,54,446],[43,60,446.5],[43,66,447],[43,72,447.5],[43,79,448],[43,85,448.5],[43,89,449],[44,1,449.5],[44,6,450],[44,12,450.5],[44,18,451],[44,24,451.5],[44,30,452],[44,36,452.5],[44,42,453],[44,49,453.5],[44,56,454],[44,59,454.5],[45,1,455],[45,6,455.5],[45,12,456],[45,17,456.5],[45,22,457],[45,28,457.5],[45,33,458],[45,36,458.5],[45,37,459],[46,1,459.5],[46,6,460],[46,11,460.5],[46,17,461],[46,22,461.5],[46,27,462],[46,32,462.5],[46,35,463],[47,1,463.5],[47,6,464],[47,11,464.5],[47,16,465],[47,21,465.5],[47,26,466],[47,31,466.5],[47,36,467],[47,38,467.5],[48,1,468],[48,6,468.5],[48,11,469],[48,16,469.5],[48,21,470],[48,26,470.5],[48,29,471],[49,1,471.5],[49,6,472],[49,11,472.5],[49,13,473],[49,18,473.5],[50,1,474],[50,6,474.5],[50,11,475],[50,16,475.5],[50,22,476],[50,28,476.5],[50,34,477],[50,40,477.5],[50,45,478],[51,1,478.5],[51,6,479],[51,12,479.5],[51,18,480],[51,24,480.5],[51,30,481],[51,36,481.5],[51,42,482],[51,48,482.5],[51,54,483],[51,58,483.5],[51,60,484],[52,1,484.5],[52,6,485],[52,12,485.5],[52,18,486],[52,24,486.5],[52,30,487],[52,36,487.5],[52,42,488],[52,46,488.5],[52,49,489],[53,1,489.5],[53,6,490],[53,12,490.5],[53,18,491],[53,25,491.5],[53,32,492],[53,39,492.5],[53,46,493],[53,53,493.5],[53,57,494],[53,60,494.5],[53,62,495],[54,1,495.5],[54,7,496],[54,13,496.5],[54,20,497],[54,27,497.5],[54,34,498],[54,41,498.5],[54,48,499],[54,53,499.5],[54,55,500],[55,1,500.5],[55,6,501],[55,12,501.5],[55,18,502],[55,24,502.5],[55,30,503],[55,36,503.5],[55,42,504],[55,48,504.5],[55,54,505],[55,60,505.5],[55,66,506],[55,72,506.5],[55,76,507],[55,78,507.5],[56,1,508],[56,7,508.5],[56,14,509],[56,21,509.5],[56,29,510],[56,37,510.5],[56,44,511],[56,52,511.5],[56,60,512],[56,68,512.5],[56,76,513],[56,84,513.5],[56,89,514],[56,94,514.5],[56,96,515],[57,1,515.5],[57,6,516],[57,11,516.5],[57,16,517],[57,21,517.5],[57,26,518],[57,29,518.5],[58,1,519],[58,5,519.5],[58,9,520],[58,13,520.5],[58,17,521],[58,19,521.5],[58,22,522],[59,1,522.5],[59,5,523],[59,9,523.5],[59,13,524],[59,17,524.5],[59,21,525],[59,24,525.5],[60,1,526],[60,5,526.5],[60,9,527],[60,13,527.5],[61,1,528],[61,7,528.5],[61,11,529],[61,14,529.5],[62,1,530],[62,6,530.5],[62,8,531],[62,11,531.5],[63,1,532],[63,6,532.5],[63,8,533],[63,11,533.5],[64,1,534],[64,6,534.5],[64,11,535],[64,14,535.5],[64,17,536],[64,18,536.5],[65,1,537],[65,5,537.5],[65,9,538],[65,12,538.5],[66,1,539],[66,5,539.5],[66,9,540],[66,12,540.5],[67,1,541],[67,6,541.5],[67,11,542],[67,16,542.5],[67,22,543],[67,27,543.5],[67,30,544],[68,1,544.5],[68,6,545],[68,12,545.5],[68,18,546],[68,24,546.5],[68,30,547],[68,37,547.5],[68,44,548],[68,51,548.5],[69,1,549],[69,6,549.5],[69,13,550],[69,20,550.5],[69,28,551],[69,36,551.5],[69,43,552],[69,52,552.5],[70,1,553],[70,7,553.5],[70,13,554],[70,20,554.5],[70,28,555],[70,36,555.5],[70,40,556],[70,44,556.5],[71,1,557],[71,7,557.5],[71,14,558],[71,21,558.5],[71,25,559],[71,28,559.5],[72,1,560],[72,7,560.5],[72,13,561],[72,19,561.5],[72,25,562],[72,28,562.5],[73,1,563],[73,6,563.5],[73,11,564],[73,16,564.5],[73,20,565],[74,1,565.5],[74,6,566],[74,12,566.5],[74,18,567],[74,25,567.5],[74,32,568],[74,39,568.5],[74,47,569],[74,54,569.5],[75,1,570],[75,6,570.5],[75,13,571],[75,21,571.5],[75,30,572],[75,37,572.5],[75,40,573],[76,1,573.5],[76,7,574],[76,13,574.5],[76,20,575],[76,26,575.5],[76,31,576],[77,1,576.5],[77,7,577],[77,14,577.5],[77,22,578],[77,30,578.5],[77,38,579],[77,46,579.5],[77,50,580],[78,1,580.5],[78,6,581],[78,13,581.5],[78,21,582],[78,30,582.5],[78,37,583],[78,40,583.5],[79,1,584],[79,7,584.5],[79,14,585],[79,21,585.5],[79,28,586],[79,35,586.5],[79,42,587],[79,46,587.5],[80,1,588],[80,7,588.5],[80,14,589],[80,21,589.5],[80,28,590],[80,35,590.5],[80,42,591],[81,1,591.5],[81,8,592],[81,16,592.5],[81,22,593],[81,26,593.5],[82,1,594],[82,7,594.5],[82,13,595],[82,17,595.5],[82,19,596],[83,1,596.5],[83,6,597],[83,12,597.5],[83,18,598],[83,24,598.5],[83,30,599],[83,36,599.5],[84,1,600],[84,6,600.5],[84,13,601],[84,20,601.5],[84,22,602],[84,25,602.5],[85,1,603],[85,7,603.5],[85,13,604],[85,18,604.5],[86,1,605],[86,8,605.5],[86,14,606],[87,1,606.5],[87,8,607],[87,14,607.5],[87,19,608],[88,1,608.5],[88,8,609],[88,14,609.5],[88,21,610],[88,26,610.5],[89,1,611],[89,7,611.5],[89,14,612],[89,21,612.5],[89,27,613],[90,1,613.5],[90,8,614],[90,15,614.5],[90,20,615],[91,1,615.5],[91,9,616],[91,15,616.5],[92,1,617],[92,8,617.5],[92,14,618],[92,18,618.5],[92,21,619],[93,1,619.5],[93,6,620],[93,11,620.5],[94,1,621],[94,5,621.5],[95,1,622],[95,5,622.5],[95,8,623],[96,1,623.5],[96,6,624],[96,11,624.5],[96,16,625],[96,19,625.5],[97,1,626],[97,4,626.5],[98,1,627],[98,5,627.5],[98,8,628],[99,1,628.5],[99,6,629],[100,1,629.5],[100,7,630],[100,11,630.5],[101,1,631],[101,7,631.5],[101,11,632],[102,1,632.5],[102,5,633],[102,8,633.5],[103,1,634],[103,3,634.5],[104,1,635],[104,6,635.5],[104,9,636],[105,1,636.5],[105,4,637],[106,1,637.5],[106,4,638],[107,1,638.5],[107,5,639],[108,1,639.5],[108,3,640],[109,1,640.5],[109,4,641],[110,1,641.5],[110,3,642],[111,1,642.5],[111,4,643],[112,1,643.5],[112,4,644],[113,1,644.5],[113,4,645],[114,1,645.5],[114,4,646],[114,6,646.5]];

// البحث عن رقم الوجه الدقيق لآية في مصحف المدينة المنورة
function wajhOf(surahName: string, ayah: number): number {
  const idx = SURAHS.findIndex(s => s.name === surahName);
  if (idx === -1) return 1;
  const surahNum = idx + 1;
  let result = 1;
  for (const [s, a, w] of MUSHAF_PAGES) {
    if (s < surahNum || (s === surahNum && a <= ayah)) {
      result = w;
    } else {
      break;
    }
  }
  return result;
}

// حساب عدد الأوجه الدقيق بين نطاقين (تصاعدي فقط) بناءً على مصحف المدينة المنورة
function pagesBetweenLinear(s1: string, a1: number, s2: string, a2: number): number {
  const idx1 = SURAHS.findIndex(s => s.name === s1);
  const idx2 = SURAHS.findIndex(s => s.name === s2);
  if (idx1 === -1 || idx2 === -1) return 0.5;
  const surah1 = idx1 + 1, surah2 = idx2 + 1;

  // ابحث عن مؤشر الوجه الأول
  let startIdx = 0;
  for (let i = 0; i < MUSHAF_PAGES.length; i++) {
    const [s, a] = MUSHAF_PAGES[i];
    if (s < surah1 || (s === surah1 && a <= a1)) startIdx = i;
    else break;
  }

  // عدّ الأوجه الكاملة
  let count = 0;
  for (let i = startIdx; i < MUSHAF_PAGES.length; i++) {
    let lastS: number, lastA: number;
    if (i + 1 >= MUSHAF_PAGES.length) {
      lastS = 114; lastA = 6;
    } else {
      const [nextS, nextA] = MUSHAF_PAGES[i + 1];
      if (nextA > 1) {
        lastS = nextS; lastA = nextA - 1;
      } else {
        const prevSurah = SURAHS.find(s => s.n === nextS - 1);
        lastS = nextS - 1; lastA = prevSurah?.ayahs ?? 3;
      }
    }
    if (surah2 > lastS || (surah2 === lastS && a2 >= lastA)) count++;
    else break;
  }

  // كل وجه كامل في البيانات = 0.5 وجه بمنطق المستخدم (2 إدخالات = وجه واحد)
  return Math.max(0.5, count * 0.5);
}

// نسخة تدعم النطاق العكسي: من الناس إلى النبأ = نفس صفحات النبأ→الناس
function pagesBetween(s1: string, a1: number, s2: string, a2: number): number {
  const absStart = absAyah(s1, a1);
  const absEnd = absAyah(s2, a2);
  if (absEnd < absStart) {
    // نطاق عكسي: نحسب صفحات النطاق الأمامي [absEnd, absStart]
    return pagesBetweenLinear(s2, a2, s1, a1);
  }
  return pagesBetweenLinear(s1, a1, s2, a2);
}

function posFromAbs(abs: number): { surah: string; ayah: number } {
  let rem = Math.max(1, abs);
  for (const s of SURAHS) {
    if (rem <= s.ayahs) return { surah: s.name, ayah: rem };
    rem -= s.ayahs;
  }
  const last = SURAHS[SURAHS.length - 1];
  return { surah: last.name, ayah: last.ayahs };
}

// آخر N أيام عمل (بدون الجمعة) من اليوم
function getLastNWorkingDays(today: string, n: number, trackType: string | null = null): string[] {
  const dates: string[] = [];
  const d = new Date(today);
  while (dates.length < n) {
    if (isWorkingDay(d.getDay(), trackType)) dates.unshift(d.toISOString().slice(0, 10));
    if (dates.length < n) d.setDate(d.getDate() - 1);
  }
  return dates;
}

// التاريخ الحالي بتوقيت مكة المكرمة (منتصف الليل = بداية اليوم)
function getMeccaTodayServer(): string {
  return new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86400000);
}

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

// Returns true if the given day-of-week (0=Sun) is a working day for the track type.
// fixation: only Sun–Wed (0,1,2,3) — skips Thu(4), Fri(5), Sat(6)
// others: skip only Fri(5)
function isWorkingDay(dayOfWeek: number, trackType: string | null): boolean {
  if (trackType === "fixation") return [0, 1, 2, 3].includes(dayOfWeek);
  return dayOfWeek !== 5;
}

// Returns the "last working day" stepping back from `date` (or same day if it's a working day).
function lastWorkingDayBefore(date: string, trackType: string | null): string {
  const d = new Date(date);
  while (!isWorkingDay(d.getDay(), trackType)) d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

// Count working days from `a` (inclusive) up to but not including `b`
function workingDaysBetween(a: string, b: string, trackType: string | null = null): number {
  const start = new Date(a);
  const end = new Date(b);
  let count = 0;
  const cur = new Date(start);
  while (cur < end) {
    if (isWorkingDay(cur.getDay(), trackType)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return count;
}

// Returns 1-based working day number in the current cycle.
// If today is a non-working day, steps back to the last working day.
function workingDayNumber(cycleStart: string, today: string, trackType: string | null = null): number {
  const effective = lastWorkingDayBefore(today, trackType);
  const start = new Date(cycleStart);
  const end = new Date(effective);
  let count = 0;
  const cur = new Date(start);
  while (cur <= end) {
    if (isWorkingDay(cur.getDay(), trackType)) count++;
    cur.setDate(cur.getDate() + 1);
  }
  return Math.max(1, count);
}

export function buildPlanEntries(
  startSurah: string, startAyah: number,
  endSurah: string, endAyah: number,
  totalPages: number,
  cycleLength: number = 21,
): PlanDayEntry[] {
  const len = Math.max(1, Math.min(60, cycleLength));
  const absStart = absAyah(startSurah, startAyah);
  const absEnd = absAyah(endSurah, endAyah);

  // نطاق عكسي: من الناس إلى النبأ (أو أي نطاق عكسي)
  // يوم ١ يبدأ من أعلى سورة (الناس)، يوم N ينتهي عند أدنى سورة
  // نستخدم حدود الأوجه الحقيقية من مصحف المدينة لضمان أن كل مقطع يبدأ من بداية سورتها
  if (absEnd < absStart) {
    // اجمع كل إدخالات MUSHAF_PAGES التي تقع ضمن النطاق [absEnd, absStart]
    const inRange: Array<{ mushafIdx: number; abs: number }> = [];
    for (let i = 0; i < MUSHAF_PAGES.length; i++) {
      const [s, a] = MUSHAF_PAGES[i];
      const abs = absAyahByNum(s, a);
      if (abs >= absEnd && abs <= absStart) {
        inRange.push({ mushafIdx: i, abs });
      }
    }

    const pagesPerDay = totalPages / len;

    // إذا لم تُوجد إدخالات وجه في النطاق، ارجع للتقسيم بالآيات
    if (inRange.length === 0) {
      const totalAyahs = Math.max(1, absStart - absEnd + 1);
      const ayahsPerDay = Math.ceil(totalAyahs / len);
      const entries: PlanDayEntry[] = [];
      for (let day = 1; day <= len; day++) {
        const chunkHigh = absStart - (day - 1) * ayahsPerDay;
        const chunkLow  = Math.max(absStart - day * ayahsPerDay + 1, absEnd);
        const start = posFromAbs(chunkLow);
        const end   = posFromAbs(chunkHigh);
        entries.push({
          dayNumber: day,
          surahStart: start.surah, ayahStart: start.ayah,
          surahEnd:   end.surah,   ayahEnd:   end.ayah,
          pages: Math.round(pagesPerDay * 10) / 10,
        });
      }
      return entries;
    }

    const totalWajhs = inRange.length;
    const entries: PlanDayEntry[] = [];
    let prevLoSurahNum = -1; // لتتبع سورة الحد الأدنى لليوم السابق ومنع التداخل

    for (let day = 1; day <= len; day++) {
      // يوم ١ = الأوجه الأعلى (الناس)، يوم len = الأوجه الأدنى (النبأ)
      const hiIdxExcl = totalWajhs - Math.round((day - 1) * totalWajhs / len);
      const loIdxIncl = totalWajhs - Math.round(day * totalWajhs / len);
      const actualHi = Math.min(hiIdxExcl - 1, totalWajhs - 1);
      const actualLo = Math.max(loIdxIncl, 0);

      // الحد الأعلى: آية ١ من السورة التي تضم أعلى وجه في هذا اليوم
      const hiWajhPos = posFromAbs(inRange[actualHi].abs);
      let hiSurahName = hiWajhPos.surah;

      // منع التداخل: إذا كانت سورة الحد الأعلى هي نفس سورة الحد الأدنى لليوم السابق
      // نتراجع خطوة للسورة التي قبلها (رقم أصغر = أبعد من الناس)
      const hiSurahNum = SURAHS.findIndex(s => s.name === hiSurahName);
      if (hiSurahNum !== -1 && SURAHS[hiSurahNum].n === prevLoSurahNum) {
        const prevSurahIdx = SURAHS.findIndex(s => s.n === prevLoSurahNum - 1);
        if (prevSurahIdx !== -1) hiSurahName = SURAHS[prevSurahIdx].name;
      }

      const hiAbs = absAyah(hiSurahName, 1);

      // الحد الأدنى: آخر آية في السورة التي تضم أدنى وجه في هذا اليوم
      const loWajhPos = posFromAbs(inRange[actualLo].abs);
      const loSurahObj = SURAHS.find(s => s.name === loWajhPos.surah);
      const loSurahLastAyah = loSurahObj?.ayahs ?? 1;
      const loAbs = Math.max(absAyah(loWajhPos.surah, loSurahLastAyah), absEnd);

      const sectionHigh = posFromAbs(hiAbs);
      const sectionLow  = posFromAbs(loAbs);

      prevLoSurahNum = loSurahObj?.n ?? -1;

      entries.push({
        dayNumber: day,
        surahStart: sectionLow.surah,  ayahStart: sectionLow.ayah,
        surahEnd:   sectionHigh.surah, ayahEnd:   sectionHigh.ayah,
        pages: Math.round(pagesPerDay * 10) / 10,
      });
    }
    return entries;
  }

  // نطاق عادي تصاعدي — تقسيم بحدود الأوجه من مصحف المدينة
  const pagesPerDay = totalPages / len;

  // جمع كل وجوه مصحف المدينة التي تقع ضمن النطاق [absStart, absEnd]
  const inRangeFwd: Array<{ mushafIdx: number; abs: number }> = [];
  for (let i = 0; i < MUSHAF_PAGES.length; i++) {
    const [s, a] = MUSHAF_PAGES[i];
    const ab = absAyahByNum(s, a);
    if (ab >= absStart && ab <= absEnd) inRangeFwd.push({ mushafIdx: i, abs: ab });
  }

  // إذا لم تُوجد أوجه في النطاق، ارجع للتقسيم بالآيات
  if (inRangeFwd.length === 0) {
    const totalAyahs = Math.max(1, absEnd - absStart + 1);
    const ayahsPerDay = Math.ceil(totalAyahs / len);
    const entries: PlanDayEntry[] = [];
    for (let day = 1; day <= len; day++) {
      const startVi = (day - 1) * ayahsPerDay;
      const endVi   = Math.min(day * ayahsPerDay - 1, totalAyahs - 1);
      const start = posFromAbs(absStart + startVi);
      const end   = posFromAbs(absStart + endVi);
      entries.push({
        dayNumber: day,
        surahStart: start.surah, ayahStart: start.ayah,
        surahEnd:   end.surah,   ayahEnd:   end.ayah,
        pages: Math.round(pagesPerDay * 10) / 10,
      });
    }
    return entries;
  }

  const totalWajhsFwd = inRangeFwd.length;
  const entries: PlanDayEntry[] = [];
  for (let day = 1; day <= len; day++) {
    const loIdxIncl = Math.round((day - 1) * totalWajhsFwd / len);
    const hiIdxExcl = Math.round(day * totalWajhsFwd / len);
    const actualLo  = Math.max(loIdxIncl, 0);
    const actualHi  = Math.min(hiIdxExcl - 1, totalWajhsFwd - 1);

    // الحد الأدنى: بداية الوجه (أو بداية النطاق لأول يوم)
    const loAbs = inRangeFwd[actualLo].abs;
    const sectionStart = posFromAbs(loAbs);

    // الحد الأعلى: آخر آية قبل بداية الوجه التالي، أو آخر آية في النطاق
    let hiAbs: number;
    if (hiIdxExcl < totalWajhsFwd) {
      hiAbs = inRangeFwd[hiIdxExcl].abs - 1;
    } else {
      hiAbs = absEnd;
    }
    const sectionEnd = posFromAbs(hiAbs);

    entries.push({
      dayNumber: day,
      surahStart: sectionStart.surah, ayahStart: sectionStart.ayah,
      surahEnd:   sectionEnd.surah,   ayahEnd:   sectionEnd.ayah,
      pages: Math.round(pagesPerDay * 10) / 10,
    });
  }
  return entries;
}

// Build plan entries from multiple (possibly non-contiguous) memorized sections
export function buildPlanEntriesFromSections(
  sections: Array<{startSurah: string; startAyah: number; endSurah: string; endAyah: number}>,
  totalPages: number,
  cycleLength: number = 21,
): PlanDayEntry[] {
  if (!sections.length) return buildPlanEntries("الفاتحة", 1, "الناس", 6, totalPages, cycleLength);
  // نطاق واحد (دائري أو تصاعدي): نفوّض لـ buildPlanEntries التي تتعامل مع كلا الحالتين
  if (sections.length === 1) {
    const s = sections[0];
    return buildPlanEntries(s.startSurah, s.startAyah, s.endSurah, s.endAyah, totalPages, cycleLength);
  }
  const ranges = sections
    .map(s => ({ absStart: absAyah(s.startSurah, s.startAyah), absEnd: absAyah(s.endSurah, s.endAyah) }))
    .filter(r => r.absEnd >= r.absStart);
  if (!ranges.length) return buildPlanEntries("الفاتحة", 1, "الناس", 6, totalPages, cycleLength);
  const totalAyahs = ranges.reduce((s, r) => s + (r.absEnd - r.absStart + 1), 0);
  const len = Math.max(1, Math.min(60, cycleLength));
  const ayahsPerDay = Math.ceil(totalAyahs / len);
  const pagesPerDay = totalPages / len;
  function virtualToAbs(vi: number): number {
    let rem = ((vi % totalAyahs) + totalAyahs) % totalAyahs;
    for (const r of ranges) {
      const slen = r.absEnd - r.absStart + 1;
      if (rem < slen) return r.absStart + rem;
      rem -= slen;
    }
    return ranges[ranges.length - 1].absEnd;
  }
  const entries: PlanDayEntry[] = [];
  for (let day = 1; day <= len; day++) {
    const startVi = (day - 1) * ayahsPerDay;
    const endVi = Math.min(day * ayahsPerDay - 1, totalAyahs - 1);
    const start = posFromAbs(virtualToAbs(startVi));
    const end = posFromAbs(virtualToAbs(endVi));
    entries.push({
      dayNumber: day,
      surahStart: start.surah, ayahStart: start.ayah,
      surahEnd: end.surah, ayahEnd: end.ayah,
      pages: Math.round(pagesPerDay * 10) / 10,
    });
  }
  return entries;
}

// ── مسار التثبيت: حساب حالة اليوم بناءً على نطاق التثبيت الجديد ──────────
// يفحص إذا كان أي سجل في الدورة (حتى تاريخ اليوم المحدد) يغطي نطاق الخطة لهذا اليوم
function getFixationDayStatus(
  planEntry: PlanDayEntry,
  allCycleRecords: (typeof recordsTable.$inferSelect)[],
  planDayDate: string,
): { exceeded: boolean; completed: boolean; partial: boolean; absent: boolean; actual: number; planned: number } {
  const planned = planEntry.pages;
  const _psA = absAyah(planEntry.surahStart, planEntry.ayahStart);
  const _peA = absAyah(planEntry.surahEnd, planEntry.ayahEnd);
  // تطبيع النطاق: دائمًا plannedLow ≤ plannedHigh بغض النظر عن اتجاه التخزين
  const plannedLow  = Math.min(_psA, _peA);
  const plannedHigh = Math.max(_psA, _peA);

  // سجلات هذا اليوم تحديدًا (للأوجه الفعلية المعروضة)
  const dayRecs = allCycleRecords.filter(r => r.date === planDayDate);
  const isAbsentToday = dayRecs.some(r => r.isAbsent);
  const actualPagesThisDay = dayRecs.reduce((s, r) => s + (r.memorizePages ?? 0), 0);

  // جميع السجلات حتى هذا اليوم التي تحتوي على نطاق التثبيت الجديد
  const rangeRecords = allCycleRecords.filter(
    r => r.date <= planDayDate && !r.isAbsent && r.memorizeSurahStart && r.memorizeSurahEnd,
  );

  for (const rec of rangeRecords) {
    const _rsA = absAyah(rec.memorizeSurahStart!, rec.memorizeAyahStart ?? 1);
    const _reA = absAyah(rec.memorizeSurahEnd!, rec.memorizeAyahEnd ?? 1);
    // تطبيع نطاق السجل الفعلي أيضًا
    const actualLow  = Math.min(_rsA, _reA);
    const actualHigh = Math.max(_rsA, _reA);

    // هل يغطي هذا السجل النطاق المخطط لهذا اليوم بالكامل؟
    if (actualLow <= plannedLow && actualHigh >= plannedHigh) {
      const exceeded = actualLow < plannedLow || actualHigh > plannedHigh;
      return {
        exceeded,
        completed: true,
        partial: false,
        absent: false,
        actual: actualPagesThisDay > 0 ? actualPagesThisDay : planned,
        planned,
      };
    }

    // تغطية جزئية؟
    const overlapStart = Math.max(actualLow, plannedLow);
    const overlapEnd = Math.min(actualHigh, plannedHigh);
    if (overlapEnd >= overlapStart) {
      // يوجد تداخل جزئي — نرجع جزئي (لكن نكمل البحث عن تغطية كاملة)
      // سنكتفي بأول تداخل جزئي كنتيجة احتياطية
      const fallbackActual = actualPagesThisDay > 0 ? actualPagesThisDay : Math.round(planned * 0.5 * 10) / 10;
      return {
        exceeded: false,
        completed: false,
        partial: true,
        absent: false,
        actual: fallbackActual,
        planned,
      };
    }
  }

  // لا يوجد تغطية بالنطاق — نرجع للمقارنة بعدد الأوجه
  if (!isAbsentToday && actualPagesThisDay > 0) {
    return {
      exceeded: actualPagesThisDay > planned,
      completed: actualPagesThisDay >= planned,
      partial: actualPagesThisDay > 0 && actualPagesThisDay < planned,
      absent: false,
      actual: actualPagesThisDay,
      planned,
    };
  }

  return { exceeded: false, completed: false, partial: false, absent: true, actual: 0, planned };
}

function calcMissedDays(
  plan: typeof reviewPlansTable.$inferSelect,
  records: (typeof recordsTable.$inferSelect)[],
): number {
  const cycleStart = plan.currentCycleStart ?? plan.startDate;
  const isFixation = plan.trackType === "fixation";

  if (isFixation) {
    // مسار التثبيت: نحسب الأيام المفقودة بناءً على تغطية النطاق
    // نبني قائمة أيام العمل في آخر 30 يوم ونفحص كل يوم
    let missed = 0;
    const today = getMeccaTodayServer();
    const thirtyDaysAgo = addDays(today, -30);
    const workingDates: string[] = [];
    {
      const cur = new Date(thirtyDaysAgo);
      const end = new Date(today);
      while (cur <= end) {
        const ds = cur.toISOString().slice(0, 10);
        if (isWorkingDay(cur.getDay(), "fixation")) workingDates.push(ds);
        cur.setDate(cur.getDate() + 1);
      }
    }
    for (const dateStr of workingDates) {
      const dayRecs = records.filter(r => r.date === dateStr);
      if (dayRecs.length === 0) continue;
      if (dayRecs.some(r => r.isAbsent)) { missed++; continue; }
      // يوجد سجل — فحص تغطية النطاق أو الأوجه
      const workingDayIdx = workingDaysBetween(cycleStart, dateStr, "fixation") % plan.cycleLength;
      const entry = plan.planEntries[workingDayIdx];
      if (!entry) continue;
      const status = getFixationDayStatus(entry, records, dateStr);
      if (status.absent || (!status.completed && !status.partial && !status.exceeded)) {
        missed++;
      }
    }
    return missed;
  }

  let missed = 0;
  for (const r of records) {
    if (!isWorkingDay(new Date(r.date).getDay(), plan.trackType)) continue;
    const workingDayIdx = workingDaysBetween(cycleStart, r.date, plan.trackType) % plan.cycleLength;
    const entry = plan.planEntries[workingDayIdx];
    const planned = entry?.pages ?? (plan.totalPages / plan.cycleLength);
    if (r.isAbsent) {
      missed++;
    } else {
      const actual = plan.trackType === "simple_review"
        ? (r.memorizePages ?? 0)
        : (r.reviewFarPages ?? 0);
      if (actual < planned * 0.8) missed++;
    }
  }
  return missed;
}

function fmtPlan(plan: typeof reviewPlansTable.$inferSelect, extra: Record<string, unknown> = {}) {
  return { ...plan, createdAt: plan.createdAt.toISOString(), updatedAt: plan.updatedAt?.toISOString() ?? null, ...extra };
}

// ── GET /api/students/:id/review-plan ──────────────────────────────────────
router.get("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  if (!["leader","track_supervisor","teacher","supervisor","student"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const studentId = parseInt(req.params.id as string);
  const [plan] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  if (!plan) { res.json(null); return; }

  const today = getMeccaTodayServer();
  const cycleStart = plan.currentCycleStart ?? plan.startDate;
  const rawWorkingDay = workingDayNumber(cycleStart, today, plan.trackType);
  const dayInCycle = Math.min(rawWorkingDay, plan.cycleLength);
  const isFriday = !isWorkingDay(new Date(today).getDay(), plan.trackType);

  const thirtyDaysAgo = addDays(today, -30);
  const recentRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.studentId, studentId), gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));

  const missedDaysLast30 = calcMissedDays(plan, recentRecords);
  const todayEntry = plan.planEntries[(dayInCycle - 1)] ?? null;
  const plannedPagesForToday = todayEntry?.pages ?? (plan.totalPages / plan.cycleLength);
  const todayRecords = recentRecords.filter(r => r.date === today);
  // المراجعة البعيدة فقط تُستخدم لحساب النصاب الفعلي والتعثر
  const useMemoForTrack = plan.trackType === "simple_review" || plan.trackType === "fixation";
  const actualPagesForToday = todayRecords.reduce((s, r) => s + (
    useMemoForTrack ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)
  ), 0);
  const cycleFarPages = recentRecords
    .filter(r => r.date >= cycleStart && !r.isAbsent)
    .reduce((s, r) => s + (
      useMemoForTrack ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)
    ), 0);
  const isCompletedEarly = cycleFarPages >= plan.totalPages && rawWorkingDay < plan.cycleLength;

  // ── Build per-day performance for current cycle ────────────────────────────
  // Fetch all records from cycle start (not just last 30)
  const cycleRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.studentId, studentId), gte(recordsTable.date, cycleStart), lte(recordsTable.date, today)));

  const dayPerformance: { dayNumber: number; date: string; exceeded: boolean; completed: boolean; partial: boolean; absent: boolean; actual: number; planned: number }[] = [];
  {
    const isFixationTrack = plan.trackType === "fixation";
    let wd = 0;
    const cur = new Date(cycleStart);
    const todayD = new Date(today);
    while (cur <= todayD) {
      const dayStr = cur.toISOString().slice(0, 10);
      if (isWorkingDay(cur.getDay(), plan.trackType)) {
        wd++;
        if (wd <= plan.cycleLength) {
          const entry = plan.planEntries[wd - 1];
          const planned = entry?.pages ?? (plan.totalPages / plan.cycleLength);
          const dayRecs = cycleRecords.filter(r => r.date === dayStr);
          const isAbsent = dayRecs.some(r => r.isAbsent);
          const actual = (plan.trackType === "simple_review" || isFixationTrack)
            ? dayRecs.reduce((s, r) => s + (r.memorizePages ?? 0), 0)
            : dayRecs.reduce((s, r) => s + (r.reviewFarPages ?? 0), 0);

          if (isFixationTrack) {
            // مسار التثبيت — الأداء يُحسب بناءً على نطاق التثبيت الجديد (السور والآيات)
            // أي إدخال يغطي نطاق يوم ما (حتى من يوم سابق) يُعلَّم كمنجز
            // هذا يسمح بتسجيل تقدم على الخطة لو الطالبة ثبتت نطاقًا أكبر من المخطط لليوم
            if (!entry) continue;
            // نُظهر الأداء فقط إذا اليوم ماضٍ أو اليوم الحالي مع وجود بيانات
            if (dayStr < today || (dayStr === today && actual > 0)) {
              // تحقق من تغطية النطاق — إذا يوم غياب صريح فهو غياب
              if (isAbsent) {
                dayPerformance.push({
                  dayNumber: wd, date: dayStr,
                  exceeded: false, completed: false, partial: false, absent: true,
                  actual: 0, planned: Math.round(planned * 10) / 10,
                });
              } else {
                const status = getFixationDayStatus(entry, cycleRecords, dayStr);
                dayPerformance.push({
                  dayNumber: wd,
                  date: dayStr,
                  exceeded: status.exceeded,
                  completed: status.completed,
                  partial: status.partial,
                  absent: status.absent,
                  actual: Math.round(status.actual * 10) / 10,
                  planned: Math.round(status.planned * 10) / 10,
                });
              }
            } else if (dayStr < today) {
              // يوم ماضٍ بدون أي سجل → غياب
              dayPerformance.push({
                dayNumber: wd, date: dayStr,
                exceeded: false, completed: false, partial: false, absent: true,
                actual: 0, planned: Math.round(planned * 10) / 10,
              });
            }
          } else {
            // باقي المسارات — النسب المئوية الحالية
            if (dayStr < today || (dayStr === today && actual > 0)) {
              dayPerformance.push({
                dayNumber: wd,
                date: dayStr,
                exceeded: !isAbsent && planned > 0 && actual > planned,
                completed: !isAbsent && actual >= planned * 0.8,
                partial: !isAbsent && actual > 0 && actual >= planned * 0.4 && actual < planned * 0.8,
                absent: isAbsent,
                actual: Math.round(actual * 10) / 10,
                planned: Math.round(planned * 10) / 10,
              });
            }
          }
        }
      }
      cur.setDate(cur.getDate() + 1);
    }
  }

  const planLockedMs = 48 * 60 * 60 * 1000;
  const planTime = plan.updatedAt ? new Date(plan.updatedAt).getTime() : new Date(plan.createdAt).getTime();
  const isLocked = Date.now() - planTime > planLockedMs;

  const [studentForLeave] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  const isOnLeave = !!(studentForLeave?.leaveStart && studentForLeave?.leaveEnd &&
    studentForLeave.leaveStart <= today && today <= studentForLeave.leaveEnd);

  const hasEnteredToday = todayRecords.length > 0;

  res.json(fmtPlan(plan, {
    dayInCycle, cycleStart, todayEntry,
    plannedPagesForToday: Math.round(plannedPagesForToday * 10) / 10,
    actualPagesForToday: Math.round(actualPagesForToday * 10) / 10,
    cycleFarPages: Math.round(cycleFarPages * 10) / 10,
    isCompletedEarly,
    missedDaysLast30,
    isStumbling: missedDaysLast30 >= 3,
    currentCycleNum: plan.cycleCount,
    isFriday,
    history: (plan.previousPlans ?? []) as PlanSnapshot[],
    dayPerformance,
    isLocked,
    isOnLeave,
    hasEnteredToday,
  }));
});

// ── POST /api/students/:id/review-plan — create or renew ──────────────────
router.post("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  const studentId = parseInt(req.params.id as string);

  if (req.userRole === "teacher") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!me?.circleId || me.circleId !== student?.circleId) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (req.userRole === "supervisor") {
    // supervisor: can create plans for students in circles they supervise
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    const [circle] = student?.circleId ? await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId)) : [null];
    if (!circle || circle.supervisorId !== me?.id) { res.status(403).json({ error: "Forbidden" }); return; }
  } else if (!["leader","track_supervisor","data_entry","deputy","student"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const body = req.body as {
    planType?: "auto" | "manual";
    planEntries?: PlanDayEntry[];
    memorizedUpToSurah?: string;
    memorizedUpToAyah?: number;
    startSurah?: string;
    startAyah?: number;
    totalPages?: number;
    theme?: PlanTheme;
    cycleLength?: number;
    memorizedSections?: Array<{startSurah: string; startAyah: number; endSurah: string; endAyah: number}>;
    startDate?: string;
    quota?: number;
  };

  const { planType = "auto", theme } = body;
  const quota = typeof body.quota === "number" ? body.quota : null; // وجه (1) أو نصف وجه (0.5) للتثبيت

  const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
  if (!student?.circleId) { res.status(400).json({ error: "الطالبة ليست في حلقة" }); return; }

  const [circle] = await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId));
  const trackType = (circle as any)?.trackType ?? "girls";

  if (trackType !== "girls" && trackType !== "fixation") {
    res.status(400).json({ error: "خطة المراجعة متاحة فقط لمسار الفتيات والتثبيت" }); return;
  }

  // خطة التثبيت: يدوية فقط — رفض الوضع التلقائي بدون quota
  if (trackType === "fixation" && planType === "auto" && quota === null) {
    res.status(400).json({ error: "خطة التثبيت يدوية فقط — يرجى إدخال الجدول يدويًا" }); return;
  }

  // خطة التثبيت: ٦ أسابيع × ٤ أيام = ٢٤ يوم عمل (ثابت)
  const isFixationQuota = trackType === "fixation" && quota !== null;
  const cycleLength = isFixationQuota
    ? 24
    : Math.max(7, Math.min(60, Number(body.cycleLength) || 21));

  const allRecords = await db.select().from(recordsTable)
    .where(eq(recordsTable.studentId, studentId))
    .orderBy(desc(recordsTable.date));

  const sections = body.memorizedSections ?? [];

  // ── مسار التثبيت مع نصاب: حساب نهاية الخطة من بداية محددة + (نصاب × 24) ──
  let totalPages: number;
  let startSurah: string;
  let startAyah: number;
  let endSurah: string;
  let endAyah: number;

  if (isFixationQuota && body.startSurah) {
    startSurah = body.startSurah;
    startAyah = body.startAyah ?? 1;
    const totalWajh = Math.round(quota! * 24 * 10) / 10;
    totalPages = totalWajh;
    // حساب موضع النهاية بناءً على بداية + إجمالي الأوجه في مصحف المدينة
    const startW = wajhOf(startSurah, startAyah);
    const targetW = startW + totalWajh;
    // إيجاد آخر إدخال في مصحف المدينة يقع عند أو قبل الوجه المستهدف
    let endEntry = MUSHAF_PAGES[MUSHAF_PAGES.length - 1];
    for (let i = 0; i < MUSHAF_PAGES.length - 1; i++) {
      const [,, w] = MUSHAF_PAGES[i];
      const [,, wNext] = MUSHAF_PAGES[i + 1];
      if (w <= targetW && wNext > targetW) { endEntry = MUSHAF_PAGES[i]; break; }
      if (w === targetW) { endEntry = MUSHAF_PAGES[i]; break; }
    }
    const endSurahObj = SURAHS.find(s => s.n === endEntry[0]);
    endSurah = endSurahObj?.name ?? "الناس";
    // نهاية الوجه = أول آية الوجه التالي - 1 (أو آخر آية في السورة)
    const endEntryIdx = MUSHAF_PAGES.findIndex(e => e === endEntry);
    const nextEntry = MUSHAF_PAGES[endEntryIdx + 1];
    if (nextEntry) {
      if (nextEntry[0] === endEntry[0]) {
        endAyah = nextEntry[1] - 1;
      } else {
        endAyah = endSurahObj?.ayahs ?? 1;
      }
    } else {
      endAyah = endSurahObj?.ayahs ?? 1;
    }
    endAyah = Math.max(1, endAyah);
  } else {
    // حساب عدد الأوجه بدقة باستخدام مصحف المدينة
    const totalPagesFromSections = sections.length
      ? Math.max(1, Math.round(sections.reduce((s, sec) =>
          s + pagesBetween(sec.startSurah, sec.startAyah, sec.endSurah, sec.endAyah)
        , 0) * 10) / 10)
      : null;

    const latestNonAbsent = allRecords.find(r => !r.isAbsent && r.memorizeSurahEnd);
    const oldestNonAbsent = [...allRecords].reverse().find(r => !r.isAbsent && r.memorizeSurahStart);

    startSurah = body.startSurah ?? oldestNonAbsent?.memorizeSurahStart ?? "الفاتحة";
    startAyah = body.startAyah ?? oldestNonAbsent?.memorizeAyahStart ?? 1;
    endSurah = body.memorizedUpToSurah ?? latestNonAbsent?.memorizeSurahEnd ?? startSurah;
    endAyah = body.memorizedUpToAyah ?? latestNonAbsent?.memorizeAyahEnd ?? startAyah;

    // حساب المجموع الكلي بمصحف المدينة إذا لم يُحدَّد يدويًا ولا عبر نطاقات
    const totalPagesFromRange = Math.max(1, Math.round(pagesBetween(startSurah, startAyah, endSurah, endAyah) * 10) / 10);
    totalPages = body.totalPages ?? totalPagesFromSections ?? totalPagesFromRange;
  }

  const today = getMeccaTodayServer();
  const planStartDate = body.startDate ?? today;

  const planEntries: PlanDayEntry[] = (planType === "manual" && body.planEntries?.length)
    ? body.planEntries
    : sections.length
      ? buildPlanEntriesFromSections(sections, totalPages, cycleLength)
      : buildPlanEntries(startSurah, startAyah, endSurah, endAyah, totalPages, cycleLength);

  const defaultTheme: PlanTheme = { primaryColor: "#059669", secondaryColor: "#d1fae5", accentColor: "#065f46", bgPattern: "plain", fontStyle: "rounded" };

  const [existing] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));

  // قيد التجديد: لا يُسمح بتجديد الخطة قبل اكتمال الدورة أو مرور ٢١ يوم عمل (سبت–خميس)
  if (existing) {
    const cycleStartForCheck = existing.currentCycleStart ?? existing.startDate;
    const rawWDForCheck = workingDayNumber(cycleStartForCheck, today);
    const workingDaysPassed = workingDaysBetween(cycleStartForCheck, today);
    const cycleComplete = rawWDForCheck > existing.cycleLength;
    if (!cycleComplete && workingDaysPassed < 21) {
      const remaining = 21 - workingDaysPassed;
      res.status(400).json({
        error: `لا يمكن تجديد الخطة قبل اكتمال الدورة أو مرور ٢١ يوم عمل (باقي ${remaining} يوم)`,
      });
      return;
    }
  }

  // Helper: insert plan notification — fires for all roles so teacher/supervisor see it
  async function insertPlanNotification(
    type: "plan_created" | "plan_renewed",
    cycleCount: number,
    pages: number,
  ) {
    const [cir] = student.circleId
      ? await db.select().from(circlesTable).where(eq(circlesTable.id, student.circleId))
      : [null];
    if (!cir) return;
    // Delete any unread notification for the same student (replace with fresh one)
    await db.delete(planNotificationsTable)
      .where(eq(planNotificationsTable.studentId, studentId));
    await db.insert(planNotificationsTable).values({
      studentId,
      studentName: student.fullName,
      circleId: cir.id,
      circleName: cir.name,
      track: cir.track ?? "",
      type,
      cycleCount,
      totalPages: pages,
      isRead: false,
    });
  }

  if (existing) {
    const snapshot: PlanSnapshot = {
      cycleCount: existing.cycleCount,
      startDate: existing.currentCycleStart ?? existing.startDate,
      endDate: today,
      totalPages: existing.totalPages,
      memorizedUpToSurah: existing.memorizedUpToSurah ?? undefined,
      memorizedUpToAyah: existing.memorizedUpToAyah ?? undefined,
      planType: existing.planType,
    };
    const prevHistory = (existing.previousPlans ?? []) as PlanSnapshot[];
    const [updated] = await db.update(reviewPlansTable).set({
      planType, cycleCount: existing.cycleCount + 1,
      totalPages, cycleLength, currentCycleStart: planStartDate,
      memorizedUpToSurah: endSurah, memorizedUpToAyah: endAyah,
      planEntries, theme: theme ?? existing.theme, status: "active",
      previousPlans: [...prevHistory, snapshot],
    }).where(eq(reviewPlansTable.studentId, studentId)).returning();
    await insertPlanNotification("plan_renewed", updated.cycleCount, updated.totalPages);
    res.json(fmtPlan(updated, { renewed: true }));
  } else {
    const [plan] = await db.insert(reviewPlansTable).values({
      studentId, trackType, planType, cycleCount: 1,
      totalPages, cycleLength, startDate: planStartDate,
      currentCycleStart: planStartDate,
      memorizedUpToSurah: endSurah, memorizedUpToAyah: endAyah,
      planEntries, theme: theme ?? defaultTheme, status: "active",
      previousPlans: [],
    }).returning();
    await insertPlanNotification("plan_created", 1, plan.totalPages);
    res.status(201).json(fmtPlan(plan));
  }
});

// ── DELETE /api/students/:id/review-plan — للقائدة والنائبة ومسؤولة المسار فقط ────
router.delete("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  if (!["leader", "deputy", "track_supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const studentId = parseInt(req.params.id as string);
  const [plan] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  if (!plan) { res.status(404).json({ error: "لا توجد خطة" }); return; }
  await db.delete(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  await db.delete(planNotificationsTable).where(eq(planNotificationsTable.studentId, studentId));
  res.json({ ok: true });
});

// ── PATCH /api/students/:id/review-plan — update entries or theme ──────────
router.patch("/students/:id/review-plan", authenticate, async (req, res): Promise<void> => {
  const isAdmin = ["leader", "deputy", "track_supervisor", "supervisor"].includes(req.userRole!);
  if (!isAdmin && !["teacher", "student"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const studentId = parseInt(req.params.id as string);

  // Student can only edit their own plan
  if (req.userRole === "student") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const conditions: Parameters<typeof and>[0][] = [eq(studentsTable.fullName, me?.name ?? "")];
    if (me?.circleId) conditions.push(eq(studentsTable.circleId, me.circleId));
    const [myStudent] = await db.select().from(studentsTable).where(and(...conditions));
    if (!myStudent || myStudent.id !== studentId) { res.status(403).json({ error: "Forbidden" }); return; }
  }
  // Teacher can only edit plans for students in their circle
  if (req.userRole === "teacher") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const [student] = await db.select().from(studentsTable).where(eq(studentsTable.id, studentId));
    if (!me?.circleId || me.circleId !== student?.circleId) { res.status(403).json({ error: "Forbidden" }); return; }
  }

  const [plan] = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.studentId, studentId));
  if (!plan) { res.status(404).json({ error: "لا توجد خطة" }); return; }

  // القائدة والمشرفة ومسؤولة المسار لا يخضعن لقيد الـ 48 ساعة
  if (!isAdmin) {
    const planTime = plan.updatedAt ? new Date(plan.updatedAt).getTime() : new Date(plan.createdAt).getTime();
    const LOCK_MS = 48 * 60 * 60 * 1000;
    if (Date.now() - planTime > LOCK_MS) {
      res.status(403).json({ error: "انتهت فترة التعديل المسموحة (٤٨ ساعة من إنشاء الخطة)" }); return;
    }
  }

  const { planEntries, planType, theme } = req.body as {
    planEntries?: PlanDayEntry[]; planType?: "manual"|"auto"; theme?: PlanTheme;
  };

  const updates: Partial<typeof reviewPlansTable.$inferInsert> = {};
  if (planEntries) updates.planEntries = planEntries;
  if (planType) updates.planType = planType;
  if (theme) updates.theme = theme;

  const [updated] = await db.update(reviewPlansTable).set(updates)
    .where(eq(reviewPlansTable.studentId, studentId)).returning();
  res.json(fmtPlan(updated));
});

// ── GET /api/review-plans/students-plans-list — overview for teacher/supervisor/leader ──
router.get("/review-plans/students-plans-list", authenticate, async (req, res): Promise<void> => {
  const role = req.userRole!;
  if (!["leader", "track_supervisor", "teacher", "supervisor"].includes(role)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const allCircles = await db.select().from(circlesTable);
  const allStudents = await db.select().from(studentsTable);
  const allTracks = await db.select().from(tracksTable);

  // Helper: effective track type (uses tracksTable.dataEntryType if trackId is set)
  function effectiveTrackType(c: typeof allCircles[0]): string {
    if (c.trackId) {
      const t = allTracks.find(t => t.id === c.trackId);
      if (t) return t.dataEntryType;
    }
    return c.trackType ?? "girls";
  }

  // خطط المراجعة خاصة بمسار الفتيات والتثبيت
  const targetCircles = allCircles.filter(c => {
    const t = effectiveTrackType(c);
    return !c.isArchived && (t === "girls" || t === "fixation");
  });

  let allowedCircleIds: number[];
  if (role === "teacher" || role === "supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    allowedCircleIds = targetCircles.filter(c => c.id === me?.circleId).map(c => c.id);
  } else if (role === "track_supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const myTrack = allTracks.find(t => t.name === me?.track);
    allowedCircleIds = myTrack
      ? targetCircles.filter(c => c.trackId === myTrack.id).map(c => c.id)
      : [];
  } else {
    allowedCircleIds = targetCircles.map(c => c.id);
  }

  if (!allowedCircleIds.length) {
    res.json({ withPlan: [], withoutPlan: [] }); return;
  }

  const students = allStudents.filter(s =>
    s.circleId && allowedCircleIds.includes(s.circleId) && !s.isArchived
  );
  if (!students.length) {
    res.json({ withPlan: [], withoutPlan: [] }); return;
  }

  const activePlans = await db.select().from(reviewPlansTable)
    .where(eq(reviewPlansTable.status, "active"));

  const planByStudent: Record<number, typeof activePlans[0]> = {};
  for (const p of activePlans) planByStudent[p.studentId] = p;

  const today = getMeccaTodayServer();
  const thirtyDaysAgo = addDays(today, -30);

  // Batch fetch recent records for all students
  const studentIds = students.map(s => s.id);
  const recentRecords = await db.select().from(recordsTable)
    .where(and(gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));
  const recordsByStudent: Record<number, typeof recentRecords> = {};
  for (const r of recentRecords) {
    if (!studentIds.includes(r.studentId)) continue;
    if (!recordsByStudent[r.studentId]) recordsByStudent[r.studentId] = [];
    recordsByStudent[r.studentId].push(r);
  }

  const withPlan: unknown[] = [];
  const withoutPlan: unknown[] = [];

  for (const student of students) {
    const circle = allCircles.find(c => c.id === student.circleId);
    const plan = planByStudent[student.id];

    const circleEffectiveType = circle ? effectiveTrackType(circle) : "girls";

    if (!plan) {
      withoutPlan.push({
        id: student.id,
        name: student.fullName,
        phone: student.phone ?? null,
        circleId: student.circleId,
        circleName: circle?.name ?? "",
        trackType: circleEffectiveType,
        track: circle?.track ?? "",
      });
    } else {
      // أيام العمل تعتمد على نوع المسار: التثبيت (أحد-أربعاء) / الفتيات (كل يوم إلا الجمعة)
      const planTrackType = plan.trackType ?? circleEffectiveType;
      const cycleStart = plan.currentCycleStart ?? plan.startDate;
      const rawDay = workingDayNumber(cycleStart, today, planTrackType);
      const dayInCycle = Math.min(rawDay, plan.cycleLength);
      const isCompleted = rawDay > plan.cycleLength;
      const studentRecords = recordsByStudent[student.id] ?? [];
      const missedDaysLast30 = calcMissedDays(plan, studentRecords);

      // حساب isCompletedEarly: أتمّت نصابها قبل انتهاء الدورة
      const cycleRecordsForStudent = studentRecords.filter(r => r.date >= cycleStart && !r.isAbsent);
      const cycleFarPages = cycleRecordsForStudent.reduce((s, r) =>
        s + ((circleEffectiveType === "simple_review" || circleEffectiveType === "fixation") ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
      const isCompletedEarly = cycleFarPages >= plan.totalPages && rawDay <= plan.cycleLength;

      // التقرير الأسبوعي: آخر 6 أيام عمل — حسب مسار الطالبة
      const weekDates = getLastNWorkingDays(today, 6, planTrackType);
      const weeklyProgress = weekDates.map(date => {
        const dayRecs = studentRecords.filter(r => r.date === date);
        const hasRecord = dayRecs.length > 0;
        const isAbsent = dayRecs.some(r => r.isAbsent);
        const actual = dayRecs.reduce((s, r) =>
          s + ((circleEffectiveType === "simple_review" || circleEffectiveType === "fixation") ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
        const cycleWD = workingDayNumber(cycleStart, date, planTrackType);
        const entry = plan.planEntries[cycleWD - 1];
        const planned = Math.round((entry?.pages ?? (plan.totalPages / plan.cycleLength)) * 10) / 10;
        return { date, planned, actual: Math.round(actual * 10) / 10, absent: isAbsent, hasRecord };
      });

      // Check if plan was recently renewed (within last 14 days) = just completed a cycle
      const prevPlans = (plan.previousPlans ?? []) as PlanSnapshot[];
      const lastSnap = prevPlans.length > 0 ? prevPlans[prevPlans.length - 1] : null;
      const justRenewed = !!lastSnap && daysBetween(lastSnap.endDate, today) <= 14;

      withPlan.push({
        id: student.id,
        name: student.fullName,
        phone: student.phone ?? null,
        circleId: student.circleId,
        circleName: circle?.name ?? "",
        trackType: circleEffectiveType,
        track: circle?.track ?? "",
        planId: plan.id,
        planType: plan.planType,
        cycleCount: plan.cycleCount,
        cycleLength: plan.cycleLength,
        totalPages: plan.totalPages,
        dayInCycle,
        isCompleted,
        isCompletedEarly,
        justRenewed,
        missedDaysLast30,
        isStumbling: missedDaysLast30 >= 3,
        memorizedUpToSurah: plan.memorizedUpToSurah,
        currentCycleStart: cycleStart,
        theme: plan.theme,
        weeklyProgress,
        weekDates,
      });
    }
  }

  // تجميع البيانات حسب الحلقة لعرض التفاصيل لمسؤولة المسار
  const byCircleMap: Record<number, {
    circleId: number; circleName: string;
    students: {
      id: number; name: string; hasPlan: boolean;
      dayInCycle?: number; cycleLength?: number; pct?: number;
      isCompleted?: boolean; isCompletedEarly?: boolean;
      isStumbling?: boolean; memorizedUpToSurah?: string;
    }[];
  }> = {};

  for (const student of students) {
    const circle = allCircles.find(c => c.id === student.circleId);
    const cid = student.circleId ?? 0;
    const cname = circle?.name ?? "";
    if (!byCircleMap[cid]) byCircleMap[cid] = { circleId: cid, circleName: cname, students: [] };

    const plan = planByStudent[student.id];
    if (!plan) {
      byCircleMap[cid].students.push({ id: student.id, name: student.fullName, hasPlan: false });
    } else {
      const circleEffType = circle ? effectiveTrackType(circle) : "girls";
      const byCirclePlanTrackType = plan.trackType ?? circleEffType;
      const cycleStart = plan.currentCycleStart ?? plan.startDate;
      const rawDay = workingDayNumber(cycleStart, today, byCirclePlanTrackType);
      const dayInCycle = Math.min(rawDay, plan.cycleLength);
      const isCompleted = rawDay > plan.cycleLength;
      const pct = Math.min(100, Math.round((dayInCycle / plan.cycleLength) * 100));
      const studentRecords = recordsByStudent[student.id] ?? [];
      const missedDaysLast30 = calcMissedDays(plan, studentRecords);
      const cycleRecs = studentRecords.filter(r => r.date >= cycleStart && !r.isAbsent);
      const cycleFarPgs = cycleRecs.reduce((s, r) =>
        s + ((circleEffType === "simple_review" || circleEffType === "fixation") ? (r.memorizePages ?? 0) : (r.reviewFarPages ?? 0)), 0);
      const isCompletedEarly = cycleFarPgs >= plan.totalPages && rawDay <= plan.cycleLength;
      byCircleMap[cid].students.push({
        id: student.id,
        name: student.fullName,
        hasPlan: true,
        dayInCycle,
        cycleLength: plan.cycleLength,
        pct,
        isCompleted,
        isCompletedEarly,
        isStumbling: missedDaysLast30 >= 3,
        memorizedUpToSurah: plan.memorizedUpToSurah ?? undefined,
      });
    }
  }

  const byCircle = Object.values(byCircleMap).sort((a, b) => a.circleName.localeCompare(b.circleName, "ar"));

  res.json({ withPlan, withoutPlan, byCircle });
});

// ── GET /api/review-plans/teacher-notifications — unread plan notifs ───────
router.get("/review-plans/teacher-notifications", authenticate, async (req, res): Promise<void> => {
  if (!["teacher", "supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  // Find the teacher's circle
  const teacherUser = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!)).limit(1);
  if (!teacherUser.length) { res.json([]); return; }
  const teacherCircle = await db.select().from(circlesTable)
    .where(eq(circlesTable.teacherId, req.userId!)).limit(1);
  if (!teacherCircle.length) { res.json([]); return; }
  const circleId = teacherCircle[0].id;
  const notifs = await db.select().from(planNotificationsTable)
    .where(and(
      eq(planNotificationsTable.circleId, circleId),
      eq(planNotificationsTable.isRead, false),
    ))
    .orderBy(desc(planNotificationsTable.createdAt));
  res.json(notifs);
});

// ── PATCH /api/review-plans/teacher-notifications/:id/read ─────────────────
router.patch("/review-plans/teacher-notifications/:id/read", authenticate, async (req, res): Promise<void> => {
  if (!["teacher", "supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const id = parseInt(req.params.id as string);
  await db.update(planNotificationsTable).set({ isRead: true })
    .where(eq(planNotificationsTable.id, id));
  res.json({ ok: true });
});

// ── GET /api/circles/:id/review-plans — teacher/supervisor view ───────────
router.get("/circles/:id/review-plans", authenticate, async (req, res): Promise<void> => {
  if (!["leader","track_supervisor","teacher","supervisor"].includes(req.userRole!)) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  const circleId = parseInt(req.params.id as string);
  const students = await db.select().from(studentsTable)
    .where(and(eq(studentsTable.circleId, circleId), eq(studentsTable.isArchived, false)));
  if (!students.length) { res.json([]); return; }

  const studentIds = students.map(s => s.id);
  const plans = await db.select().from(reviewPlansTable).where(eq(reviewPlansTable.status, "active"));
  const circlePlans = plans.filter(p => studentIds.includes(p.studentId));
  if (!circlePlans.length) { res.json([]); return; }

  const today = getMeccaTodayServer();
  const thirtyDaysAgo = addDays(today, -30);
  const allRecords = await db.select().from(recordsTable)
    .where(and(eq(recordsTable.circleId, circleId), gte(recordsTable.date, thirtyDaysAgo), lte(recordsTable.date, today)));

  res.json(circlePlans.map(plan => {
    const student = students.find(s => s.id === plan.studentId);
    const cycleStart = plan.currentCycleStart ?? plan.startDate;
    const daysIn = Math.max(0, daysBetween(cycleStart, today));
    const dayInCycle = (daysIn % plan.cycleLength) + 1;
    const studentRecords = allRecords.filter(r => r.studentId === plan.studentId);
    const missedDaysLast30 = calcMissedDays(plan, studentRecords);
    return {
      studentId: plan.studentId,
      studentName: student?.fullName ?? "غير معروف",
      planType: plan.planType, cycleCount: plan.cycleCount,
      dayInCycle, totalPages: plan.totalPages,
      missedDaysLast30, isStumbling: missedDaysLast30 >= 3,
      theme: plan.theme, planEntries: plan.planEntries,
      memorizedUpToSurah: plan.memorizedUpToSurah,
      memorizedUpToAyah: plan.memorizedUpToAyah,
      currentCycleStart: cycleStart,
    };
  }));
});

// ── GET /api/review-plans/fixation-weekly-report ──────────────────────────
router.get("/review-plans/fixation-weekly-report", authenticate, async (req, res): Promise<void> => {
  const role = req.userRole;
  if (!["leader", "deputy", "teacher", "supervisor", "track_supervisor", "data_entry"].includes(role ?? "")) {
    res.status(403).json({ error: "Forbidden" }); return;
  }

  const today = getMeccaTodayServer();
  const todayDate = new Date(today + "T12:00:00Z");
  const dow = todayDate.getUTCDay(); // 0=Sun

  // Start of current week (last Sunday)
  const weekStartDate = new Date(todayDate);
  weekStartDate.setUTCDate(todayDate.getUTCDate() - dow);

  // Fixation working days: Sun(0), Mon(1), Tue(2), Wed(3)
  const weekDates = [0, 1, 2, 3].map(i => {
    const d = new Date(weekStartDate);
    d.setUTCDate(weekStartDate.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  });
  const weekStart = weekDates[0];

  // Fetch all active fixation plans with student + circle
  let allRows = await db
    .select({ plan: reviewPlansTable, student: studentsTable, circle: circlesTable })
    .from(reviewPlansTable)
    .innerJoin(studentsTable, eq(reviewPlansTable.studentId, studentsTable.id))
    .innerJoin(circlesTable, eq(studentsTable.circleId, circlesTable.id))
    .where(and(eq(reviewPlansTable.status, "active"), eq(reviewPlansTable.trackType, "fixation")));

  // Role-based filtering
  if (role === "teacher") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    allRows = allRows.filter(r => r.student.circleId === me?.circleId);
  } else if (role === "supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    allRows = allRows.filter(r => r.circle.supervisorId === me?.id);
  } else if (role === "track_supervisor") {
    const [me] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    const myTracks = await db.select().from(tracksTable).where(eq(tracksTable.supervisorId, me!.id));
    const trackIds = new Set(myTracks.map(t => t.id));
    allRows = allRows.filter(r => r.circle.trackId != null && trackIds.has(r.circle.trackId!));
  }

  if (!allRows.length) { res.json({ weekStart, weekDates, students: [] }); return; }

  // Fetch records for the week
  const weekRecords = await db.select().from(recordsTable)
    .where(and(gte(recordsTable.date, weekDates[0]), lte(recordsTable.date, weekDates[3])));

  const studentIdSet = new Set(allRows.map(r => r.student.id));
  const relevant = weekRecords.filter(r => r.studentId !== null && studentIdSet.has(r.studentId!));

  const students = allRows.map(({ plan, student, circle }) => {
    const srecs = relevant.filter(r => r.studentId === student.id);
    const days = weekDates.map(date => {
      const dayRecs = srecs.filter(r => r.date === date);
      const isAbsent = dayRecs.some(r => r.isAbsent);
      const pages = dayRecs.reduce((s, r) => s + (r.memorizePages ?? 0), 0);
      return { date, hasEntry: dayRecs.length > 0, isAbsent, pages };
    });
    const totalPages = Math.round(days.reduce((s, d) => s + d.pages, 0) * 10) / 10;
    const dayInCycle = Math.min(
      workingDayNumber(plan.currentCycleStart ?? plan.startDate, today, "fixation"),
      plan.cycleLength,
    );
    return {
      studentId: student.id,
      studentName: student.fullName,
      circleName: circle.name,
      dayInCycle,
      cycleLength: plan.cycleLength,
      days,
      totalPages,
      daysAttended: days.filter(d => d.hasEntry && !d.isAbsent).length,
      daysMissed: days.filter(d => !d.hasEntry && d.date <= today).length,
    };
  });

  students.sort((a, b) =>
    a.circleName.localeCompare(b.circleName, "ar") ||
    a.studentName.localeCompare(b.studentName, "ar"),
  );

  res.json({ weekStart, weekDates, students });
});

export default router;
