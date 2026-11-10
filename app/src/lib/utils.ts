import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Mới tạo lên trước. Dùng chung cho cả ba bảng (hồ sơ, proxy, kịch bản) để chúng không trôi khỏi
 * nhau — ba lần gõ tay là ba cơ hội viết nhầm `a - b`.
 *
 * `?? 0` không thừa: `createdAt` được thêm vào sau, và `migrate` của các store KHÔNG điền cho bản
 * ghi cũ. Thiếu nó thì `undefined - number` ra `NaN`, và một comparator trả `NaN` khiến thứ tự
 * phụ thuộc vào thuật toán sort của engine — sai một cách không ổn định, kiểu khó lần nhất.
 * Bản ghi cũ không có mốc thời gian sẽ nằm cuối, đúng nghĩa "cũ nhất".
 */
export function byNewestFirst(a: { createdAt?: number }, b: { createdAt?: number }): number {
  return (b.createdAt ?? 0) - (a.createdAt ?? 0);
}

export function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
