import { NextRequest, NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

// 模拟数据集存储（实际项目中应连接后端数据库）
const datasets: Map<string, any> = new Map();

// 上传文件
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: "没有上传文件" }, { status: 400 });
    }

    // 检查文件大小（100MB 限制）
    if (file.size > 100 * 1024 * 1024) {
      return NextResponse.json({ error: "文件大小超过限制" }, { status: 400 });
    }

    // 检查文件类型
    const allowedTypes = [
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-excel",
      "text/csv",
      "application/json",
      "text/xml",
    ];
    const allowedExtensions = [".xlsx", ".xls", ".csv", ".json", ".xml"];
    const fileExtension = path.extname(file.name).toLowerCase();

    if (!allowedExtensions.includes(fileExtension)) {
      return NextResponse.json(
        { error: "不支持的文件格式" },
        { status: 400 }
      );
    }

    // 保存文件
    const uploadDir = path.join(process.cwd(), "uploads");
    await mkdir(uploadDir, { recursive: true });

    const fileId = `ds_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const filePath = path.join(uploadDir, `${fileId}${fileExtension}`);

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);
    await writeFile(filePath, buffer);

    // 创建数据集记录
    const dataset = {
      id: fileId,
      name: file.name.replace(/\.[^/.]+$/, ""),
      fileName: file.name,
      fileSize: file.size,
      fileFormat: fileExtension.replace(".", ""),
      objectKey: filePath,
      rowCount: 0,
      columnCount: 0,
      status: "ready",
      qualityScore: 0,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    // 模拟解析数据
    if (fileExtension === ".csv" || fileExtension === ".json") {
      const content = buffer.toString("utf-8");
      const lines = content.split("\n").filter((l) => l.trim());
      dataset.rowCount = Math.max(0, lines.length - 1); // 减去表头
      dataset.columnCount = lines[0]?.split(",").length || 0;
    }

    datasets.set(fileId, dataset);

    return NextResponse.json({
      datasetId: fileId,
      taskId: fileId,
      status: "ready",
      dataset,
    });
  } catch (error) {
    console.error("上传失败:", error);
    return NextResponse.json(
      { error: "上传失败，请重试" },
      { status: 500 }
    );
  }
}
