import clsx from "clsx";
import { twMerge } from "tailwind-merge";

export const ButtonSize = {
  Sm: "sm",
  Md: "md",
  Lg: "lg",
  Xl: "xl",
} as const;
export type ButtonSize = (typeof ButtonSize)[keyof typeof ButtonSize];

export const ButtonVariant = {
  Primary: "primary",
  Secondary: "secondary",
} as const;
export type ButtonVariant = (typeof ButtonVariant)[keyof typeof ButtonVariant];

class Button extends HTMLElement {
  connectedCallback(): void {
    this.render();
  }

  attributeChangedCallback(): void {
    this.render();
  }

  private getSize(): ButtonSize {
    const attribute = this.getAttribute("size")?.toLowerCase();
    if (
      attribute === ButtonSize.Sm ||
      attribute === ButtonSize.Md ||
      attribute === ButtonSize.Lg ||
      attribute === ButtonSize.Xl
    ) {
      return attribute as ButtonSize;
    }
    // invalid input, default to base
    return ButtonSize.Md;
  }

  private getVariant(): ButtonVariant {
    const attribute = this.getAttribute("variant")?.toLowerCase();
    if (
      attribute === ButtonVariant.Primary ||
      attribute === ButtonVariant.Secondary
    ) {
      return attribute as ButtonVariant;
    }
    // invalid input, default to primary
    return ButtonVariant.Primary;
  }

  private render(): void {
    const variant = this.getVariant();
    const size = this.getSize();
    const className = this.getAttribute("class") ?? "";
    const disabled = this.hasAttribute("disabled");
    const type = this.getAttribute("type") ?? "submit";

    const label =
      this.textContent?.trim() || this.getAttribute("label") || "Submit";

    const sizeClasses = clsx({
      "py-2 px-4 text-sm": size === ButtonSize.Sm,
      "py-2.5 px-6 text-base": size === ButtonSize.Md,
      "py-3 px-8 text-lg": size === ButtonSize.Lg,
      "py-4 px-10 text-xl": size === ButtonSize.Xl,
    });
    const variantClasses = clsx({
      "bg-linear-to-r from-amber-500 via-orange-500 to-pink-500 hover:from-amber-600 hover:via-orange-600 hover:to-pink-600 active:from-amber-700 active:via-orange-700 active:to-pink-600 focus:ring-amber-400":
        variant === ButtonVariant.Primary,
      "bg-white/20 hover:bg-white/30 text-white focus:ring-white/30":
        variant === ButtonVariant.Secondary,
    });

    const classes = twMerge(
      "font-semibold disabled:bg-gray-300 disabled:cursor-not-allowed disabled:opacity-60 not-disabled:cursor-pointer text-white font-bold rounded-lg transition duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 shadow-md hover:shadow-lg",
      variantClasses,
      sizeClasses,
      className,
    );

    this.innerHTML = `
      <button
        class="${classes}"
        ${disabled ? "disabled" : ""}
        type="${type}"
      >
        ${label}
      </button>
    `;
  }
}

customElements.define("component-button", Button);
