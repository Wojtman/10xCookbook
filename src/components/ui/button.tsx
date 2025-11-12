import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-semibold uppercase tracking-[0.16em] transition-transform duration-150 disabled:pointer-events-none disabled:opacity-60 [&_svg]:pointer-events-none [&_svg:not([class*='size-'])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-[rgba(248,232,196,0.7)] focus-visible:ring-offset-2 focus-visible:ring-offset-[rgba(50,28,14,0.45)] aria-invalid:ring-[rgba(143,58,32,0.35)]",
  {
    variants: {
      variant: {
        default: "book-button",
        destructive:
          "book-button bg-[radial-gradient(circle_at_30%_20%,_rgba(255,255,255,0.12)_0%,_rgba(219,98,54,0.95)_45%,_rgba(123,37,16,0.95)_100%)]",
        outline: "book-button-outline",
        secondary:
          "book-button-outline text-ink hover:shadow-md",
        ghost:
          "text-ink-soft hover:bg-[rgba(255,248,227,0.4)] hover:text-ink",
        link: "text-ink underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-6 py-2 has-[>svg]:px-5",
        sm: "h-9 rounded-md gap-1.5 px-4 has-[>svg]:px-3",
        lg: "h-12 rounded-lg px-8 has-[>svg]:px-6",
        icon: "size-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean
  }) {
  const Comp = asChild ? Slot : "button"

  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
