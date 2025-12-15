import { client } from "./api";
import {
  clearFormError,
  getField,
  setFormError,
  toggleBusy,
} from "./utils/form";
import UserStorage from "./storage/user";

const userStorage = new UserStorage(null, [
  (user) => {
    if (user) {
      redirectToApp();
    }
  },
]);

function redirectToApp(): void {
  window.location.href = "/";
}

function wireLoginForm(): void {
  const form = document.querySelector<HTMLFormElement>("#login-form");

  if (!form) {
    return;
  }

  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    clearFormError(form);
    toggleBusy(form, true);

    try {
      const email = getField(form, "email");
      const password = getField(form, "password");

      if (!email || !password) {
        throw new Error("All fields are required");
      }

      const user = await client.login({ email, password });
      userStorage.set(user);
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error
          ? error.message
          : "Unable to sign in. Please try again.";
      const friendlyMessage =
        message === "Unable to login"
          ? "Invalid email or password. Please try again."
          : message;
      setFormError(form, friendlyMessage);
    } finally {
      toggleBusy(form, false);
    }
  });
}

document.addEventListener("DOMContentLoaded", () => {
  wireLoginForm();
});
