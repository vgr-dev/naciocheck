# NacioCheck — listing en español

Textos para copiar tal cual en la Chrome Web Store y en addons.mozilla.org. Los límites y su origen están en
`REQUIREMENTS.md`; las medidas de este archivo, al final.

## Nombre

`NacioCheck` — 9 caracteres (el límite del manifiesto es 75).

## Descripción corta (Chrome Web Store, sale del manifiesto — máximo 132)

```
Comprueba el estado de tu solicitud de nacionalidad española por residencia. Los datos guardados se quedan en tu dispositivo.
```

Es la misma cadena que `public/_locales/es/messages.json` (`extensionDescription`). Si cambia una, cambia la otra.

## Resumen (AMO — máximo 250)

```
Te avisa cuando cambia el estado de tu solicitud de nacionalidad por residencia: rellena el formulario oficial, deja el captcha y guarda cada comprobación en tu navegador. Sin cuentas ni servidores propios; solo consulta la sede oficial al comprobar.
```

## Descripción detallada (Chrome Web Store) y descripción de AMO — sin límite práctico

```
NacioCheck convierte la consulta del estado de tu solicitud de nacionalidad por residencia en tres pasos: te avisa, marcas el captcha y ves el resultado.

Qué hace
- Rellena por ti el formulario oficial de la sede electrónica con los datos que guardaste una vez.
- Deja a la vista solo el captcha: lo marcas tú, como pide la web.
- Envía la consulta cuando el captcha está resuelto y lee el estado que devuelve.
- Guarda cada comprobación en tu navegador y te avisa cuando el estado cambia.
- Explica qué significa cada estado, con sus fuentes, y señala lo que solo está documentado por despachos.
- Puedes poner un recordatorio: un aviso a la hora y los días que elijas.

Qué no hace
- No resuelve el captcha ni lo envía a ningún servicio: lo marcas tú.
- No crea cuentas y no tiene servidores propios. Tus datos guardados se quedan en este navegador; cuando lanzas una comprobación, el formulario oficial se envía a la sede electrónica, igual que si lo rellenaras a mano.
- No es una herramienta oficial y no tiene ninguna relación con el Ministerio de Justicia.

Tus datos
- El NIE, el número de expediente, el año y la fecha de nacimiento se guardan solo en este navegador, en el almacenamiento local de la extensión.
- Puedes cifrarlos con una contraseña tuya, cuando quieras y desde Opciones. Si la olvidas no se pueden recuperar: el historial se queda, pero tendrás que volver a escribir las solicitudes.
- Puedes exportar una copia a un archivo, importarla en otro navegador y borrarlo todo desde Opciones.
- No hay analítica, ni publicidad, ni rastreo, ni telemetría. La extensión solo habla con la sede electrónica, y solo cuando tú lanzas una comprobación.

Idiomas
Español e inglés. Firefox para Android es un objetivo y aún no se ha verificado en un dispositivo.

Aviso
NacioCheck no está afiliado al Ministerio de Justicia ni a ningún organismo público. Los estados y sus explicaciones se basan en la propia web oficial y en lo observado en expedientes reales, y no sustituyen a la resolución oficial.
```

## Categorías y etiquetas

- Chrome Web Store: categoría **Productivity** (herramientas), idioma principal español.
- AMO: categorías de escritorio **Alerts & Updates** y **Other** (máximo 2); categorías de Android
  **Alerts & Updates** y **Other**; etiquetas `nacionalidad`, `residencia`, `expediente`, `recordatorio`,
  `privacidad`.

## Resumen de privacidad (para la ficha y para la política del sitio)

Tus datos guardados se quedan en el dispositivo. Los datos personales que escribes (NIE, número de expediente,
año y fecha de nacimiento) se guardan solo en el almacenamiento local de la extensión, y la contraseña del
cifrado, si la usas, solo en el almacenamiento de sesión, que el navegador borra al cerrarse. No hay cuentas, ni
servidores propios, ni analítica, ni publicidad. La extensión no envía nada a nosotros; la única petición es el
formulario oficial que tú envías a `https://sede.mjusticia.gob.es/eConsultas/*` al comprobar, y el captcha que
carga esa página. La copia de seguridad es un archivo que eliges tú donde guardarlo.

## Cómo se comprueba

````sh
# Longitudes (la cadena entre bloques ``` se mide con sed entre las líneas que la delimitan)
wc -m store/listing.es.md            # el archivo entero
node -e "const t=require('fs').readFileSync('store/listing.es.md','utf8').split('\`\`\`');console.log(t[1].trim().length, t[3].trim().length, t[5].trim().length)"
````
