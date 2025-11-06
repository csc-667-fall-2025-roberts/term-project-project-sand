//use css selector to find the element
const button: Element | null = document.querySelector("#test-button");

button?.addEventListener("Click", (event) => {
  event.preventDefault();

  setTimeout(() => {
    alert("Button clicked was 1 seconds ago!");
  }, 1000);
});
