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
  Ghost: "ghost",
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
      attribute === ButtonVariant.Secondary ||
      attribute === ButtonVariant.Ghost
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
      "px-4 py-2 text-sm": size === ButtonSize.Sm,
      "px-6 py-2.5 text-base": size === ButtonSize.Md,
      "px-8 py-3 text-lg": size === ButtonSize.Lg,
      "px-10 py-4 text-xl": size === ButtonSize.Xl,
    });
    const variantClasses = clsx({
      "bg-linear-to-r from-amber-500 via-orange-500 to-pink-500 text-white hover:from-amber-600 hover:via-orange-600 hover:to-pink-600 focus:ring-amber-400 active:from-amber-700 active:via-orange-700 active:to-pink-600":
        variant === ButtonVariant.Primary,
      "border border-gray-200 bg-white text-gray-900 hover:bg-gray-50 focus:ring-amber-400 active:bg-gray-100":
        variant === ButtonVariant.Secondary,
      "bg-white/20 text-white hover:bg-white/30 focus:ring-white/30":
        variant === ButtonVariant.Ghost,
    });

    const classes = twMerge(
      "rounded-lg font-bold font-semibold shadow-md transition duration-200 not-disabled:cursor-pointer hover:shadow-lg focus:ring-2 focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-gray-300 disabled:opacity-60",
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
