//use css selector to find the element

const button: Element | null = document.querySelector("#test-button");

button?.addEventListener("click", (event) => {
  event.preventDefault();

  setTimeout(() => {
    alert("Button clicked was 1 second ago!");
  }, 1000);
});
