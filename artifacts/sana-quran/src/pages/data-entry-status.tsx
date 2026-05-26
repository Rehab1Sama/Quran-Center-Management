import { useGetMissingDataEntry, useGetDailySnapshot } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, AlertCircle, Clock } from "lucide-react";

export default function DataEntryStatusPage() {
  const { data: missing } = useGetMissingDataEntry(undefined, { query: { queryKey: ["missingData"] } });
  const { data: snapshot } = useGetDailySnapshot({ query: { queryKey: ["dailySnapshot"] } });

  const missingArr: any[] = (missing as unknown as any[]) ?? [];
  const notRecordedInWeek = snapshot?.circlesNotRecordedInWeek ?? [];

  // Group by track
  const grouped: Record<string, any[]> = {};
  missingArr.forEach((item: any) => {
    const track = item.track ?? "غير محدد";
    if (!grouped[track]) grouped[track] = [];
    grouped[track].push(item);
  });

  return (
    <div className="space-y-6" dir="rtl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">حالة البيانات المُدخلة</h1>
        <p className="text-muted-foreground text-sm mt-1">الطالبات التي لم تُدخل بياناتهن بعد</p>
      </div>

      {/* Circles not recorded in last 7 days */}
      {notRecordedInWeek.length > 0 && (
        <Card className="border-0 shadow-sm border-r-4 border-r-rose-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-rose-600">
              <Clock className="w-4 h-4" />
              حلقات لم تُسجّل منذ أكثر من ٧ أيام
              <Badge className="bg-rose-100 text-rose-700 border-0 text-xs">{notRecordedInWeek.length}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="flex flex-wrap gap-2">
              {notRecordedInWeek.map(c => (
                <div key={c.circleId} className="bg-rose-50 rounded-xl px-3 py-2 text-sm">
                  <span className="font-semibold text-rose-800">{c.circleName}</span>
                  <span className="text-xs text-rose-500 mr-1.5">· {c.track}</span>
                  {c.daysSinceLastRecord != null && (
                    <span className="text-xs text-rose-400">
                      ({c.daysSinceLastRecord} يوم)
                    </span>
                  )}
                  {c.daysSinceLastRecord == null && (
                    <span className="text-xs text-rose-400">(لا سجلات)</span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {missingArr.length === 0 ? (
        <Card className="border-0 shadow-sm" data-testid="card-all-complete">
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-14 h-14 text-emerald-500 mx-auto mb-3" />
            <p className="text-lg font-bold text-foreground">تم إدخال جميع البيانات</p>
            <p className="text-muted-foreground text-sm mt-1">لا توجد سجلات ناقصة</p>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <Card className="border-0 shadow-sm" data-testid="card-total-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-amber-600">{missingArr.length}</p>
                <p className="text-xs text-muted-foreground mt-1">إجمالي الناقصة</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" data-testid="card-tracks-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-primary">{Object.keys(grouped).length}</p>
                <p className="text-xs text-muted-foreground mt-1">مسارات متأثرة</p>
              </CardContent>
            </Card>
            <Card className="border-0 shadow-sm" data-testid="card-circles-missing">
              <CardContent className="p-4 text-center">
                <p className="text-3xl font-bold text-blue-600">
                  {Array.from(new Set(missingArr.map((m: any) => m.circleId))).length}
                </p>
                <p className="text-xs text-muted-foreground mt-1">حلقات متأثرة</p>
              </CardContent>
            </Card>
          </div>

          {Object.entries(grouped).map(([track, items]) => (
            <Card key={track} className="border-0 shadow-sm" data-testid={`card-track-${track}`}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                  مسار {track}
                  <Badge className="bg-amber-100 text-amber-700 border-0 text-xs">{items.length}</Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-muted/50 border-b border-border">
                      <tr>
                        <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground">الطالبة</th>
                        <th className="text-right py-2.5 px-4 font-semibold text-muted-foreground">الحلقة</th>
                      </tr>
                    </thead>
                    <tbody>
                      {items.map((item: any) => (
                        <tr key={`${item.studentId}-${item.circleId}`}
                          className="border-b border-border/50 hover:bg-muted/30 transition-colors"
                          data-testid={`row-missing-${item.studentId}`}
                        >
                          <td className="py-2.5 px-4 font-semibold">{item.studentName}</td>
                          <td className="py-2.5 px-4 text-muted-foreground text-xs">{item.circleName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          ))}
        </>
      )}
    </div>
  );
}
