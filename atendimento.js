(() => {
  const campos = document.querySelectorAll('[data-horario-atendimento]');
  if (!campos.length) return;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  fetch('https://navoryx-backend-2.onrender.com/site-config', { signal: controller.signal, cache: 'no-store' })
    .then(res => {
      if (!res.ok) throw new Error('Configuração indisponível');
      return res.json();
    })
    .then(config => {
      const horario = typeof config.horario_atendimento === 'string' ? config.horario_atendimento.trim().slice(0, 300) : '';
      campos.forEach(campo => {
        const rodape = campo.hasAttribute('data-horario-rodape');
        campo.textContent = horario ? (rodape ? 'Atendimento: ' : '') + horario : (rodape ? '' : 'Horário a definir');
        campo.hidden = rodape && !horario;
      });
    })
    .catch(() => {})
    .finally(() => clearTimeout(timeout));
})();
