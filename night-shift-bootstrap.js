// Keep a readable loading state until the GPU backend and shaders are ready.
try {
  await import('./night-shift-game.js');
} catch (error) {
  console.error('Night Shift graphics startup failed:', error);
  const overlay = document.getElementById('ov');
  document.body.appendChild(overlay);
  overlay.classList.remove('hide');
  overlay.replaceChildren();
  const title = document.createElement('h1');
  title.textContent = 'Night Shift';
  const message = document.createElement('p');
  message.textContent = 'The office could not start. Enable hardware acceleration or try an updated browser.';
  const retry = document.createElement('button');
  retry.textContent = 'Try again';
  retry.addEventListener('click', () => location.reload());
  overlay.append(title, message, retry);
}
