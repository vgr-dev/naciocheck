import { REMINDER_PRESETS } from '../../core/schedule';
import { listApplications, setReminder } from '../../core/storage';
import { buildApplicationForm } from '../shared/application-form';
import { button, el, openPage, root } from '../shared/ui';

/**
 * First run: what the extension does, what it deliberately does not do, one application and a reminder.
 * The encryption offer arrives in Phase 8.
 */

function main(): void {
  const view = root();
  const header = el('div', 'row');
  const icon = el('img');
  icon.src = '/icon/icon-animated.svg';
  icon.alt = '';
  icon.width = 72;
  icon.height = 72;
  header.append(icon, el('h1', 'title', 'NacioCheck'));
  view.append(header);

  view.append(
    el(
      'p',
      'subtitle',
      'Comprueba el estado de tu solicitud de nacionalidad por residencia sin rellenar el formulario cada vez.',
    ),
  );

  const does = el('ul', 'history');
  for (const line of [
    'Rellena el formulario oficial por ti y te deja solo el captcha.',
    'Guarda cada comprobación en este navegador y te avisa si el estado cambia.',
    'Explica qué significa cada estado, con sus fuentes.',
  ]) {
    does.append(el('li', '', line));
  }

  const doesNot = el('ul', 'history');
  for (const line of [
    'No resuelve el captcha ni lo envía a ningún servicio: lo marcas tú.',
    'No envía tus datos a ningún servidor: ni NIE, ni fecha de nacimiento, ni historial.',
    'No es una herramienta oficial del Ministerio de Justicia; la resolución llega por DEHú.',
  ]) {
    doesNot.append(el('li', '', line));
  }

  view.append(el('h2', 'section', 'Qué hace'), does, el('h2', 'section', 'Qué no hace'), doesNot);

  view.append(el('h2', 'section', 'Tu solicitud'));
  view.append(buildApplicationForm((label) => announce(view, `Solicitud «${label}» guardada.`)));

  view.append(el('h2', 'section', '¿Cuándo te aviso?'));
  view.append(
    el(
      'p',
      'hint',
      'Elige una hora a la que suelas estar con el dispositivo: el captcha lo tienes que marcar tú.',
    ),
  );

  const presets = el('div', 'row');
  for (const preset of REMINDER_PRESETS) {
    presets.append(
      button(
        `Laborables a las ${preset.config.time}`,
        () => {
          void (async () => {
            await setReminder(preset.config);
            await browser.runtime.sendMessage({ type: 'naciocheck:reschedule' });
            announce(
              view,
              `Recordatorio guardado para los laborables a las ${preset.config.time}.`,
            );
          })();
        },
        'button primary',
      ),
    );
  }
  view.append(presets);

  const finish = el('div', 'row');
  finish.append(
    button(
      'Terminar',
      () => {
        void (async () => {
          const applications = await listApplications();
          if (applications.length > 0) {
            await browser.runtime.sendMessage({ type: 'naciocheck:start-check-run' });
          } else {
            openPage('/options.html');
          }
        })();
      },
      'button primary',
    ),
    button('Cambiar todo en Opciones', () => {
      openPage('/options.html');
    }),
  );
  view.append(el('h2', 'section', 'Listo'), finish);
}

function announce(view: HTMLElement, text: string): void {
  view.querySelector('.saved')?.remove();
  view.append(el('p', 'hint saved', text));
}

void main();
