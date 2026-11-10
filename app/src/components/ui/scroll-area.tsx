import { ScrollArea as ScrollAreaPrimitive } from 'radix-ui';
import { cn } from '@/lib/utils';

/**
 * Vùng cuộn có thanh cuộn DO RADIX VẼ, không phải thanh cuộn của trình duyệt.
 *
 * Vì thế nó không ăn theo quy tắc `::-webkit-scrollbar` toàn cục trong `styles/index.css` — phải
 * tự dùng cùng token màu, nếu không hai loại thanh cuộn trong cùng một app sẽ khác màu nhau.
 */
export function ScrollArea({
  className,
  children,
  ...props
}: React.ComponentProps<typeof ScrollAreaPrimitive.Root>) {
  return (
    <ScrollAreaPrimitive.Root className={cn('relative overflow-hidden', className)} {...props}>
      <ScrollAreaPrimitive.Viewport className="size-full">{children}</ScrollAreaPrimitive.Viewport>
      <ScrollAreaPrimitive.Scrollbar
        orientation="vertical"
        className="flex w-2.5 touch-none select-none p-[2px] transition-colors"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--scrollbar-thumb)] transition-colors hover:bg-[var(--scrollbar-thumb-hover)]" />
      </ScrollAreaPrimitive.Scrollbar>
      {/* Nội dung tràn ngang vẫn xảy ra (bảng hẹp, chuỗi dài không ngắt được) — thiếu thanh này
          thì phần tràn ra không có cách nào với tới bằng chuột. */}
      <ScrollAreaPrimitive.Scrollbar
        orientation="horizontal"
        className="flex h-2.5 touch-none select-none flex-col p-[2px] transition-colors"
      >
        <ScrollAreaPrimitive.Thumb className="relative flex-1 rounded-full bg-[var(--scrollbar-thumb)] transition-colors hover:bg-[var(--scrollbar-thumb-hover)]" />
      </ScrollAreaPrimitive.Scrollbar>
      <ScrollAreaPrimitive.Corner />
    </ScrollAreaPrimitive.Root>
  );
}
