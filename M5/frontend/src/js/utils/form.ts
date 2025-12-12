/**
 * Gets the value of a field in the form
 * @param form - The form element to get the field from
 * @param name - The name of the field to get
 * @returns The value of the field
 * @throws An error if the field is not found
 */
export function getField(form: HTMLFormElement, name: string): string | null {
  const value = form.elements.namedItem(name);
  if (value instanceof HTMLInputElement) return value.value.trim();
  throw new Error(`Field ${name} not found`);
}

/**
 * Toggles the busy state of the submit button in the form
 * @param form - The form element to toggle the busy state of
 * @param isBusy - Whether the form is busy
 */
export function toggleBusy(form: HTMLFormElement, isBusy: boolean): void {
  const button = form.querySelector<HTMLButtonElement>("button[type='submit']");
  if (button) {
    button.disabled = isBusy;
  }
}

/**
 * Displays an inline error message at the top of the form
 * @param form - The form element to display the error on
 * @param message - The message to render
 */
export function setFormError(form: HTMLFormElement, message: string): void {
  let error = form.querySelector<HTMLParagraphElement>("[data-form-error]");
  if (!error) {
    error = document.createElement("p");
    error.dataset.formError = "true";
    error.className =
      "text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2";
    form.insertAdjacentElement("afterbegin", error);
  }

  error.textContent = message;
}

/**
 * Removes any inline error message from the form
 * @param form - The form element to clear errors from
 */
export function clearFormError(form: HTMLFormElement): void {
  const error = form.querySelector("[data-form-error]");
  if (error) {
    error.remove();
  }
}
