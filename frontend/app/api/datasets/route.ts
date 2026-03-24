import { NextRequest, NextResponse } from "next/server";

const GO_BACKEND_URL = process.env.GO_BACKEND_URL || "http://localhost:3001";

// 代理转发到 Go 后端 - 获取数据集列表
export async function GET(request: NextRequest) {
  try {
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${GO_BACKEND_URL}/api/datasets/${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, { headers });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("获取数据集列表代理失败:", error);
    return NextResponse.json(
      { error: "获取数据集列表失败" },
      { status: 500 }
    );
  }
}

// 代理转发到 Go 后端 - 删除数据集
export async function DELETE(request: NextRequest) {
  try {
    const headers: Record<string, string> = {};
    const authHeader = request.headers.get("Authorization");
    if (authHeader) {
      headers["Authorization"] = authHeader;
    }

    const searchParams = request.nextUrl.searchParams.toString();
    const url = `${GO_BACKEND_URL}/api/datasets/${searchParams ? `?${searchParams}` : ""}`;

    const response = await fetch(url, {
      method: "DELETE",
      headers,
    });
    const data = await response.json();

    if (!response.ok) {
      return NextResponse.json(data, { status: response.status });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("删除数据集代理失败:", error);
    return NextResponse.json(
      { error: "删除数据集失败" },
      { status: 500 }
    );
  }
}
