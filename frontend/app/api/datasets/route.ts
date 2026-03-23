import { NextRequest, NextResponse } from "next/server";
import { unlink } from "fs/promises";
import path from "path";

// 模拟数据集存储
const datasets: Map<string, any> = new Map();

// 获取数据集列表
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const search = searchParams.get("search") || "";
  const page = parseInt(searchParams.get("page") || "1");
  const limit = parseInt(searchParams.get("limit") || "20");

  let result = Array.from(datasets.values());

  // 搜索过滤
  if (search) {
    result = result.filter(
      (d) =>
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.fileName.toLowerCase().includes(search.toLowerCase())
    );
  }

  // 分页
  const total = result.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  result = result.slice(offset, offset + limit);

  return NextResponse.json({
    data: result,
    total,
    page,
    limit,
    totalPages,
  });
}

// 删除数据集
export async function DELETE(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "缺少文件 ID" }, { status: 400 });
  }

  const dataset = datasets.get(id);
  if (!dataset) {
    return NextResponse.json({ error: "文件不存在" }, { status: 404 });
  }

  // 删除物理文件
  try {
    const filePath = dataset.objectKey;
    if (filePath) {
      await unlink(filePath);
    }
  } catch (err: any) {
    // 文件可能不存在，继续删除记录
    console.warn("删除文件失败:", err.message);
  }

  // 删除记录
  datasets.delete(id);

  return NextResponse.json({ success: true, message: "文件已删除" });
}
