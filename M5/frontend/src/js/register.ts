import { client } from "./api";
import {
  clearFormError,
  getField,
  setFormError,
  toggleBusy,
} from "./utils/form";

function redirectToLogin(): void {
  window.location.href = "/login";
}

function wireRegisterForm(): void {
  const form = document.querySelector<HTMLFormElement>("#register-form");
  if (!form) return;

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormError(form);
    toggleBusy(form, true);

    try {
      const displayName = getField(form, "displayName");
      const email = getField(form, "email");
      const password = getField(form, "password");
      const confirmPassword = getField(form, "confirmPassword");

      if (!displayName || !email || !password || !confirmPassword) {
        throw new Error("All fields are required");
      }

      if (password !== confirmPassword) {
        throw new Error("Passwords do not match");
      }

      await client.register({ displayName, email, password });
      redirectToLogin();
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to register. Please try again.";
      const friendlyMessage =
        message === "Unable to register"
          ? "Unable to register with those details. Please check and try again."
          : message;
      setFormError(form, friendlyMessage);
    } finally {
      toggleBusy(form, false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireRegisterForm();
});
