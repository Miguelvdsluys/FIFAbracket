const firebaseConfig = {
  apiKey: 'AIzaSyDkriLYbIsLQ2UUza-bse8AErkbcA3iR4I',
  authDomain: 'fifa22-bracket.firebaseapp.com',
  projectId: 'fifa22-bracket',
  storageBucket: 'fifa22-bracket.firebasestorage.app',
  messagingSenderId: '944644692768',
  appId: '1:944644692768:web:8abbddf92b7383f28a1545',
  measurementId: 'G-S79Q4VEEYV',
};

const button = document.getElementById('account-button');
const dialog = document.getElementById('account-dialog');
const form = document.getElementById('account-form');
const credentials = document.getElementById('account-credentials');
const accountEmail = document.getElementById('account-email');
const status = document.getElementById('account-status');
const actions = document.getElementById('account-actions');
const signOutButton = document.getElementById('account-signout');
const closeButton = document.getElementById('account-close');
const modeButton = document.getElementById('register-mode');
const primaryButton = actions.querySelector('.primary');
const { email, password } = form.elements;

const errorMessages = {
  'auth/invalid-credential': 'Het e-mailadres of wachtwoord klopt niet.',
  'auth/user-not-found': 'Het e-mailadres of wachtwoord klopt niet.',
  'auth/wrong-password': 'Het e-mailadres of wachtwoord klopt niet.',
  'auth/email-already-in-use': 'Dit e-mailadres is al in gebruik.',
  'auth/weak-password': 'Kies een wachtwoord van minstens zes tekens.',
  'auth/password-does-not-meet-requirements': 'Kies een sterker wachtwoord.',
  'auth/too-many-requests': 'Te veel pogingen. Probeer het later opnieuw.',
  'auth/network-request-failed': 'Controleer je internetverbinding en probeer het opnieuw.',
  'auth/operation-not-allowed': 'Inloggen met e-mail en wachtwoord is nog niet ingeschakeld.',
};

let connection;
export function connect() {
  connection ??= (async () => {
    const [{ initializeApp }, sdk] = await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.6.0/firebase-auth.js'),
    ]);
    const auth = sdk.getAuth(initializeApp(firebaseConfig));
    auth.languageCode = 'nl';
    sdk.onAuthStateChanged(auth, renderUser);
    await auth.authStateReady();
    return { auth, sdk };
  })().catch(error => {
    connection = undefined;
    throw error;
  });
  return connection;
}

function setRegistration(registering) {
  primaryButton.value = registering ? 'register' : 'login';
  primaryButton.textContent = registering ? 'Registreren' : 'Inloggen';
  modeButton.textContent = registering ? 'Terug naar inloggen' : 'Account maken';
  password.autocomplete = registering ? 'new-password' : 'current-password';
}

function renderUser(user) {
  button.textContent = user ? 'Mijn account' : 'Inloggen';
  credentials.hidden = actions.hidden = Boolean(user);
  accountEmail.hidden = signOutButton.hidden = !user;
  accountEmail.textContent = user?.email ?? '';
}

function setBusy(busy) {
  for (const control of form.querySelectorAll('input, button[type="submit"], #register-mode')) {
    control.disabled = busy;
  }
}

button.addEventListener('click', async () => {
  status.textContent = 'Account laden…';
  setBusy(true);
  dialog.showModal();
  try {
    await connect();
    status.textContent = '';
    if (!credentials.hidden && dialog.open) email.focus();
  } catch {
    status.textContent = 'Accountservice onbereikbaar. Controleer je internetverbinding en open het venster opnieuw.';
  } finally {
    setBusy(false);
  }
});

closeButton.addEventListener('click', () => dialog.close());
dialog.addEventListener('cancel', event => {
  if (closeButton.disabled) event.preventDefault();
});
dialog.addEventListener('close', () => {
  form.reset();
  setRegistration(false);
});
modeButton.addEventListener('click', () => {
  setRegistration(primaryButton.value !== 'register');
  status.textContent = '';
  password.value = '';
  email.focus();
});

form.addEventListener('submit', async event => {
  event.preventDefault();
  const action = event.submitter?.value ?? primaryButton.value;
  if (action === 'reset' && !email.reportValidity()) return;

  setBusy(true);
  closeButton.disabled = true;
  status.textContent = 'Even geduld…';
  try {
    const { auth, sdk } = await connect();
    const address = email.value.trim();
    switch (action) {
      case 'register':
        await sdk.createUserWithEmailAndPassword(auth, address, password.value);
        status.textContent = 'Je account is aangemaakt.';
        break;
      case 'reset':
        try {
          await sdk.sendPasswordResetEmail(auth, address);
        } catch (error) {
          if (error.code !== 'auth/user-not-found') throw error;
        }
        status.textContent = 'Als dit e-mailadres bij een account hoort, ontvang je een link om je wachtwoord te wijzigen.';
        break;
      case 'logout':
        await sdk.signOut(auth);
        setRegistration(false);
        status.textContent = 'Je bent uitgelogd.';
        break;
      default:
        await sdk.signInWithEmailAndPassword(auth, address, password.value);
        status.textContent = 'Je bent ingelogd.';
    }
    password.value = '';
  } catch (error) {
    status.textContent = errorMessages[error.code] ?? 'De accountactie is mislukt. Probeer het opnieuw.';
  } finally {
    closeButton.disabled = false;
    setBusy(false);
  }
});

connect().catch(() => {});
