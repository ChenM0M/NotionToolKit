/**
 * 统一错误处理模块
 * 提供错误码、自定义错误类、中文错误消息和 API 响应工具函数
 */

import { NextResponse } from "next/server";

/**
 * 错误码枚举
 */
export enum ErrorCode {
  // 认证相关 (1xxx)
  AUTH_MISSING_TOKEN = 1001,
  AUTH_INVALID_TOKEN = 1002,
  AUTH_TOKEN_EXPIRED = 1003,
  AUTH_INSUFFICIENT_PERMISSIONS = 1004,

  // API 相关 (2xxx)
  API_RATE_LIMITED = 2001,
  API_NOT_FOUND = 2002,
  API_INVALID_REQUEST = 2003,
  API_SERVER_ERROR = 2004,
  API_TIMEOUT = 2005,

  // 验证相关 (3xxx)
  VALIDATION_MISSING_FIELD = 3001,
  VALIDATION_INVALID_FORMAT = 3002,
  VALIDATION_INVALID_PAGE_ID = 3003,

  // 导出相关 (4xxx)
  EXPORT_CONVERSION_FAILED = 4001,
  EXPORT_IMAGE_DOWNLOAD_FAILED = 4002,
  EXPORT_ZIP_CREATION_FAILED = 4003,
  EXPORT_NO_PAGES_SELECTED = 4004,

  // 网络相关 (5xxx)
  NETWORK_ERROR = 5001,
  NETWORK_OFFLINE = 5002,

  // 未知错误
  UNKNOWN_ERROR = 9999,
}

/**
 * 中文错误消息映射
 */
export const ERROR_MESSAGES: Record<ErrorCode, string> = {
  // 认证相关
  [ErrorCode.AUTH_MISSING_TOKEN]: "请先配置 Notion Token",
  [ErrorCode.AUTH_INVALID_TOKEN]: "Token 无效，请检查后重试",
  [ErrorCode.AUTH_TOKEN_EXPIRED]: "Token 已过期，请重新配置",
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]:
    "权限不足，请确保 Integration 已添加到相关页面",

  // API 相关
  [ErrorCode.API_RATE_LIMITED]: "请求过于频繁，请稍后重试",
  [ErrorCode.API_NOT_FOUND]: "页面不存在或无权访问",
  [ErrorCode.API_INVALID_REQUEST]: "请求参数错误",
  [ErrorCode.API_SERVER_ERROR]: "Notion 服务暂时不可用，请稍后重试",
  [ErrorCode.API_TIMEOUT]: "请求超时，请检查网络后重试",

  // 验证相关
  [ErrorCode.VALIDATION_MISSING_FIELD]: "缺少必要参数",
  [ErrorCode.VALIDATION_INVALID_FORMAT]: "参数格式错误",
  [ErrorCode.VALIDATION_INVALID_PAGE_ID]: "无效的页面 ID",

  // 导出相关
  [ErrorCode.EXPORT_CONVERSION_FAILED]: "页面转换失败",
  [ErrorCode.EXPORT_IMAGE_DOWNLOAD_FAILED]: "图片下载失败",
  [ErrorCode.EXPORT_ZIP_CREATION_FAILED]: "ZIP 文件创建失败",
  [ErrorCode.EXPORT_NO_PAGES_SELECTED]: "请先选择要导出的页面",

  // 网络相关
  [ErrorCode.NETWORK_ERROR]: "网络连接错误",
  [ErrorCode.NETWORK_OFFLINE]: "网络已断开，请检查网络连接",

  // 未知错误
  [ErrorCode.UNKNOWN_ERROR]: "发生未知错误，请稍后重试",
};

/**
 * 自定义应用错误类
 */
export class AppError extends Error {
  public readonly code: ErrorCode;
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(
    code: ErrorCode,
    message?: string,
    statusCode = 500,
    details?: unknown
  ) {
    super(message || ERROR_MESSAGES[code]);
    this.name = "AppError";
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;

    // 保持正确的原型链
    Object.setPrototypeOf(this, AppError.prototype);
  }

  toJSON() {
    return {
      error: this.message,
      code: this.code,
      details: this.details,
    };
  }
}

/**
 * API 响应接口
 */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  code?: ErrorCode;
}

/**
 * 创建成功的 API 响应
 */
export function createApiResponse<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(
    {
      success: true,
      data,
    } as ApiResponse<T>,
    { status }
  );
}

/**
 * 创建错误的 API 响应
 */
export function createErrorResponse(
  error: AppError | Error | string,
  status?: number
): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: error.message,
        code: error.code,
      } as ApiResponse,
      { status: status || error.statusCode }
    );
  }

  const message = error instanceof Error ? error.message : error;
  return NextResponse.json(
    {
      success: false,
      error: message,
      code: ErrorCode.UNKNOWN_ERROR,
    } as ApiResponse,
    { status: status || 500 }
  );
}

/**
 * Notion API 错误状态码映射
 */
const NOTION_ERROR_MAP: Record<number, { code: ErrorCode; status: number }> = {
  400: { code: ErrorCode.API_INVALID_REQUEST, status: 400 },
  401: { code: ErrorCode.AUTH_INVALID_TOKEN, status: 401 },
  403: { code: ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS, status: 403 },
  404: { code: ErrorCode.API_NOT_FOUND, status: 404 },
  429: { code: ErrorCode.API_RATE_LIMITED, status: 429 },
  500: { code: ErrorCode.API_SERVER_ERROR, status: 500 },
  502: { code: ErrorCode.API_SERVER_ERROR, status: 502 },
  503: { code: ErrorCode.API_SERVER_ERROR, status: 503 },
};

/**
 * 解析 Notion API 错误
 */
export function parseNotionError(error: unknown): AppError {
  // 处理 Notion SDK 错误
  if (error && typeof error === "object" && "status" in error) {
    const notionError = error as { status: number; message?: string };
    const mapping = NOTION_ERROR_MAP[notionError.status];

    if (mapping) {
      return new AppError(
        mapping.code,
        notionError.message || ERROR_MESSAGES[mapping.code],
        mapping.status,
        error
      );
    }
  }

  // 处理网络错误
  if (error instanceof Error) {
    if (error.message.includes("fetch") || error.message.includes("network")) {
      return new AppError(ErrorCode.NETWORK_ERROR, undefined, 500, error);
    }
    if (error.message.includes("timeout")) {
      return new AppError(ErrorCode.API_TIMEOUT, undefined, 408, error);
    }
  }

  // 未知错误
  const message = error instanceof Error ? error.message : "Unknown error";
  return new AppError(ErrorCode.UNKNOWN_ERROR, message, 500, error);
}

/**
 * 获取用户友好的错误消息
 */
export function getErrorMessage(error: unknown): string {
  if (error instanceof AppError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  if (typeof error === "string") {
    return error;
  }
  return ERROR_MESSAGES[ErrorCode.UNKNOWN_ERROR];
}
