import { cn } from '@/lib/utils';

/*
 * `bg-skeleton` (token `--skeleton` = một chút màu chữ, xem index.css) chứ không phải `bg-accent`: accent
 * là sắc nhấn trong suốt ~13% — trên thẻ/tấm KÍNH của các phong cách nó gần như biến mất. Lấy từ màu chữ
 * nên đúng tương phản ở mọi phong cách, cả sáng lẫn tối. Nhịp mờ-rõ tắt khi người dùng giảm chuyển động.
 */
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="skeleton"
      className={cn('animate-pulse rounded-md bg-skeleton motion-reduce:animate-none', className)}
      {...props}
    />
  );
}
