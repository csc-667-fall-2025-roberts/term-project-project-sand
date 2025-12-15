let fieldIdCounter = 0;

function makeId(prefix: string): string {
  return `${prefix}-${Date.now()}-${++fieldIdCounter}`;
}

class Field extends HTMLElement {
  connectedCallback(): void {
    this.render();
  }

  private render(): void {
    const label = this.getAttribute("label") ?? "";
    const type = this.getAttribute("type") ?? "text";
    const name = this.getAttribute("name") ?? "";
    const placeholder = this.getAttribute("placeholder") ?? "";
    const autocomplete = this.getAttribute("autocomplete") ?? "";
    const required = this.hasAttribute("required") ? "required" : "";
    const disabled = this.hasAttribute("disabled") ? "disabled" : "";
    const id = this.getAttribute("input-id") ?? makeId("component-field");

    this.innerHTML = `
    <div class="flex flex-col gap-2">
      ${label ? `<label for="${id}" class="block text-sm font-medium text-gray-700">${label}</label>` : ""}
      <input
        type="${type}"
        id="${id}"
        name="${name}"
        ${required}
        ${disabled}
        class="disabled:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60 w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-transparent transition-colors bg-white text-gray-900 placeholder-gray-400"
        placeholder="${placeholder}"
        autocomplete="${autocomplete}"
      />
    </div>
    `;
  }
}

customElements.define("component-field", Field);
