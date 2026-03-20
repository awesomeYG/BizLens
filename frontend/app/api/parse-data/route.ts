import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json({ error: "未上传文件" }, { status: 400 });
    }

    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(Boolean);
    const headers = lines[0]?.split(/[,\t]/).map((h) => h.trim()) || [];
    const rows = lines.slice(1, 11).map((line) => {
      const cells = line.split(/[,\t]/).map((c) => c.trim());
      return headers.reduce(
        (acc, h, i) => ({ ...acc, [h]: cells[i] ?? "" }),
        {} as Record<string, string>
      );
    });

    const summary = {
      fileName: file.name,
      columns: headers,
      rowCount: lines.length - 1,
      sampleRows: rows,
    };

    return NextResponse.json({
      summary: JSON.stringify(summary, null, 2),
      columns: headers,
      sampleData: rows,
    });
  } catch (err) {
    console.error("Parse data error:", err);
    return NextResponse.json(
      { error: "解析文件失败" },
      { status: 500 }
    );
  }
}
