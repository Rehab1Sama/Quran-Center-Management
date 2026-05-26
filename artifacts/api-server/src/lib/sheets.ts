import { google } from "googleapis";
import { logger } from "./logger";

const SPREADSHEET_ID = "1oEXh5HcuWI5x2gdSAgHRb65eA59Rkj6xxJ8fdD09pYs";

const STUDENT_HEADERS = [
  "الاسم الكامل", "البريد الإلكتروني", "رقم الجوال", "الدولة",
  "الفئة العمرية", "المستوى التعليمي", "المسار", "اسم الحلقة",
  "بداية الحفظ", "تاريخ التسجيل",
];

const VOLUNTEER_HEADERS = [
  "الاسم الكامل", "البريد الإلكتروني", "الدور", "رقم الجوال",
  "الدولة", "المسار", "اسم الحلقة", "تاريخ التسجيل",
];

const ROLE_LABELS: Record<string, string> = {
  leader: "قائدة",
  teacher: "معلمة",
  supervisor: "مشرفة",
  track_supervisor: "مسؤولة مسار",
  deputy: "نائبة",
  data_entry: "مدخلة بيانات",
  student: "طالبة",
  volunteer: "متطوعة",
  exam_supervisor: "مشرفة اختبار",
};

function getSheetsClient() {
  const accessToken = process.env.GOOGLE_SHEETS_ACCESS_TOKEN;
  if (!accessToken) return null;
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });
  return google.sheets({ version: "v4", auth });
}

async function ensureHeaders(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string,
  headers: string[],
): Promise<void> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!A1:Z1`,
    });
    const firstRow = response.data.values?.[0];
    if (!firstRow || firstRow.length === 0) {
      await sheets.spreadsheets.values.update({
        spreadsheetId: SPREADSHEET_ID,
        range: `${sheetName}!A1`,
        valueInputOption: "RAW",
        requestBody: { values: [headers] },
      });
    }
  } catch (err) {
    logger.warn({ err, sheetName }, "Could not ensure headers in sheet");
  }
}

async function isEmailInSheet(
  sheets: ReturnType<typeof google.sheets>,
  sheetName: string,
  email: string,
  emailColLetter: string,
): Promise<boolean> {
  try {
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: SPREADSHEET_ID,
      range: `${sheetName}!${emailColLetter}2:${emailColLetter}`,
    });
    const values: string[][] = (response.data.values as string[][]) ?? [];
    return values.some((row) => row[0]?.toLowerCase() === email.toLowerCase());
  } catch {
    return false;
  }
}

export async function appendStudentToSheet(data: {
  fullName: string;
  email: string;
  phone?: string | null;
  country?: string | null;
  ageRange?: string | null;
  educationLevel?: string | null;
  track?: string | null;
  circleName?: string | null;
  memorizeFrom?: string | null;
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await ensureHeaders(sheets, "طالبات", STUDENT_HEADERS);
    const isDuplicate = await isEmailInSheet(sheets, "طالبات", data.email, "B");
    if (isDuplicate) {
      logger.info({ email: data.email }, "Student already in sheet, skipping duplicate");
      return;
    }

    const today = new Date().toLocaleDateString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "طالبات!A:J",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          data.fullName,
          data.email,
          data.phone ?? "",
          data.country ?? "",
          data.ageRange ?? "",
          data.educationLevel ?? "",
          data.track ?? "",
          data.circleName ?? "",
          data.memorizeFrom ?? "",
          today,
        ]],
      },
    });
    logger.info({ email: data.email }, "Student appended to Google Sheet");
  } catch (err) {
    logger.error({ err }, "Failed to append student to Google Sheet");
  }
}

export async function appendVolunteerToSheet(data: {
  fullName: string;
  email: string;
  role: string;
  phone?: string | null;
  country?: string | null;
  track?: string | null;
  circleName?: string | null;
}): Promise<void> {
  const sheets = getSheetsClient();
  if (!sheets) return;

  try {
    await ensureHeaders(sheets, "متطوعات", VOLUNTEER_HEADERS);
    const isDuplicate = await isEmailInSheet(sheets, "متطوعات", data.email, "B");
    if (isDuplicate) {
      logger.info({ email: data.email }, "Volunteer already in sheet, skipping duplicate");
      return;
    }

    const today = new Date().toLocaleDateString("ar-SA", {
      year: "numeric", month: "short", day: "numeric",
    });

    await sheets.spreadsheets.values.append({
      spreadsheetId: SPREADSHEET_ID,
      range: "متطوعات!A:H",
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          data.fullName,
          data.email,
          ROLE_LABELS[data.role] ?? data.role,
          data.phone ?? "",
          data.country ?? "",
          data.track ?? "",
          data.circleName ?? "",
          today,
        ]],
      },
    });
    logger.info({ email: data.email }, "Volunteer appended to Google Sheet");
  } catch (err) {
    logger.error({ err }, "Failed to append volunteer to Google Sheet");
  }
}
