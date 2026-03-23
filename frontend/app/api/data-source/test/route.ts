import { NextRequest, NextResponse } from "next/server";
import type { DataSourceConfig, DataSourceType } from "@/lib/types";

const DATABASE_SOURCE_TYPES: DataSourceType[] = [
  "mysql",
  "postgresql",
  "sqlserver",
  "oracle",
  "mongodb",
  "redis",
  "elasticsearch",
  "clickhouse",
  "snowflake",
  "bigquery",
  "hive",
  "spark",
  "kafka",
];

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { dataSource?: DataSourceConfig };
    const dataSource = body.dataSource;

    if (!dataSource?.name || !dataSource.type) {
      return NextResponse.json({ error: "缺少数据源基础信息" }, { status: 400 });
    }

    if (DATABASE_SOURCE_TYPES.includes(dataSource.type)) {
      const connection = dataSource.connection;
      if (!connection?.host || !connection.port || !connection.database || !connection.username || !connection.password) {
        return NextResponse.json({ error: "数据库连接信息不完整" }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `已校验 ${dataSource.type} 连接参数，目标 ${connection.host}:${connection.port}/${connection.database} 格式有效。`,
      });
    }

    if (dataSource.type === "api") {
      if (!dataSource.apiConfig?.url) {
        return NextResponse.json({ error: "API 地址不能为空" }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `已校验 API 配置，目标 ${dataSource.apiConfig.url} 格式有效。`,
      });
    }

    if (dataSource.type === "csv" || dataSource.type === "excel") {
      if (!dataSource.fileConfig?.fileName) {
        return NextResponse.json({ error: "文件名不能为空" }, { status: 400 });
      }

      return NextResponse.json({
        ok: true,
        message: `已校验文件数据源配置，文件 ${dataSource.fileConfig.fileName} 可用于后续上传接入。`,
      });
    }

    return NextResponse.json({
      ok: true,
      message: `已校验 ${dataSource.type} 数据源配置。`,
    });
  } catch {
    return NextResponse.json({ error: "测试连接失败" }, { status: 500 });
  }
}
