import { NextRequest, NextResponse } from "next/server";

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
