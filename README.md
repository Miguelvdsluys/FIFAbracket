# FIFA 22 Bracket Tracker

Nederlandstalige knock-outtracker met een responsive dashboard, toernooien voor 2–32 teams, doelpuntenmakers, strafschoppen, correcties, ranglijsten en een wedstrijdarchief.

## Starten

Vereist Node.js 24 of nieuwer. Er zijn geen externe runtime-dependencies.

```sh
npm start
```

De server luistert op poort 3000, instelbaar via `PORT`. SQLite bewaart de gegevens in `data/tracker.sqlite`. Maak voor een consistente back-up gebruik van SQLite-backuptools of stop de server voordat je de volledige datamap kopieert. Met `DATA_DIR` kies je een andere datamap. De app is bedoeld voor een gedeelde, vertrouwde omgeving; voeg authenticatie toe voordat je hem publiek toegankelijk maakt.

```sh
npm test
```

De tests spelen een zes-teamstoernooi uit, testen vrijstellingen, strafschoppen, onbekende goals, een winnaarcorrectie met teruggezette finale, statistieken, alle teamgroottes en daadwerkelijke database-opslag na een serverherstart. Testgegevens worden uitsluitend in tijdelijke databases opgeslagen.

## Teamcatalogus

Er wordt bewust geen ongeverifieerde historische dataset meegeleverd. Open **Teamcatalogus beheren** en importeer JSON of voeg handmatige gegevens toe. De catalogus toont bron, spelmodus, selectiedatum, aantallen en ontbrekende spelersselecties. Handmatige teams en spelers zijn gemarkeerd. Importeer een nieuwe versie om ontbrekende spelers of teams aan te vullen; bestaande toernooien bewaren hun eigen volledige snapshot.

JSON-structuur (de lege lijsten vul je met echte brongegevens):

```json
{
  "name": "Naam van de FIFA 22-selectie-update",
  "source": "Verifieerbare bron-URL of bronbeschrijving",
  "mode": "FIFA 22 Kick-off",
  "date": "2021-10-01",
  "teams": [],
  "players": []
}
```

Een team heeft `id`, `name` en optioneel `league`, `country`, `type` (`club` of `nationaal`), `manual` (boolean). Een speler heeft `id`, `name`, `teamId` en optioneel `manual`. Gebruik stabiele string-ID's over versies heen. Dezelfde speler-ID kan bij meerdere teamkoppelingen voorkomen, maar iedere combinatie speler/team moet uniek zijn. De importer controleert teamverwijzingen en duplicaten. JSON-import betekent niet dat de bron automatisch als FIFA 22 is geverifieerd; controleer de bron zelf.

## Werking

Bij handmatige indeling is de selectievolgorde de plaatsing. De preview toont de exacte eerste ronde; vrijstellingen staan vooraan. Loten gebruikt een Fisher–Yates shuffle. Een vrijstelling telt niet als overwinning of wedstrijd. De eindstand bevat reguliere speeltijd én verlenging; de aparte strafschoppenserie bepaalt uitsluitend de winnaar. Niet toegewezen en onbekende goals tellen voor teams, eigen goals ook, maar alleen expliciet aan spelers toegewezen goals komen in de topscorerslijst.

Een winnaarcorrectie toont gespeelde vervolguitslagen die na bevestiging worden verwijderd. Alle statistieken worden steeds opnieuw afgeleid, zonder opgeslagen tellers. Filters werken per toernooi en vanaf een datum voor bevestigde uitslagen; deelname en bereikte finaleplaatsen blijven context van de geselecteerde toernooien. Team-, speler- en duelprofielen openen onderliggende wedstrijden.

De SQLite-opslag gebruikt revisiecontrole: een verouderde browser kan wijzigingen van een andere browser niet stil overschrijven. Er is geen account- of gebruikersbeheer. Verwijder een toernooi alleen via de expliciete bevestiging in de app.

## Online via GitHub Pages

De website wordt gepubliceerd vanuit de branch `gh-pages`. De repository-instelling voor Pages gebruikt **Deploy from a branch → gh-pages → / (root)**. Updates op `main` worden automatisch getest en gebouwd. Publiceer een nieuwe versie met `npm run publish:pages` vanuit deze checkout; dit vereist Git-schrijftoegang tot de repository. Het script bouwt de app en werkt `gh-pages` bij zonder force-push. GitHub start daarna de standaardworkflow **pages build and deployment**. De website-instellingen blijven ongewijzigd.

`npm run build` maakt `dist/` met relatieve assetpaden, zodat de app ook onder `/FIFAbracket/` werkt. Deze versie bewaart de gegevens in **IndexedDB van je eigen browser**, niet in SQLite op een server. De site is publiek, maar je lokale toernooidata wordt niet naar GitHub verstuurd en niet tussen apparaten of vrienden gesynchroniseerd. Wissen van sitegegevens wist ook de lokale database. De bestaande Node-server blijft SQLite gebruiken.

## Mobiele app installeren

De GitHub Pages-versie is een Progressive Web App (PWA). Er is geen App Store-download nodig.

- **Android (Chrome):** open de website, tik op **App installeren** en bevestig. Als de browser geen installatievenster aanbiedt, toont de knop de instructies voor het browsermenu.
- **iPhone/iPad (Safari):** kies **Deel → Zet op beginscherm** / **Voeg toe aan beginscherm**. Kies ‘Open als webapp’ als Safari die optie toont.

Open de app eerst volledig met internet. Zodra onderaan **Beschikbaar offline** verschijnt, zijn de appbestanden gecachet. De GitHub-versie kan daarna zonder internet toernooien aanmaken, uitslagen invoeren en ranglijsten bekijken. Dezelfde IndexedDB-database blijft bij herladen behouden. Een andere browser of een geïnstalleerde app kan een eigen opslagcontext gebruiken. Installeer daarom bij voorkeur voordat je je toernooien invoert.

De serviceworker blijft binnen het pad van deze app, cachet alleen appbestanden en verwijdert geen toernooidata. Nieuwe builds krijgen automatisch een nieuwe cacheversie. Sluit alle geopende appvensters en tabbladen en open de app opnieuw om een gereedstaande update te activeren. De Node/SQLite-versie heeft geen offline serviceworker, omdat die de server nodig heeft voor opslag.

De mobiele interface heeft een vaste navigatiebalk, knoppen van minimaal 44 pixels, numerieke toetsenborden voor scores, een rondekiezer en schermvullende formulieren. Grote ranglijsten kunnen binnen hun eigen tabel horizontaal worden gescrold.
