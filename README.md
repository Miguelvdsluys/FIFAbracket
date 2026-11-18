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

## Standaard FIFA 22-catalogus

Iedere bezoeker krijgt automatisch de meegeleverde FIFA 22-catalogus: 701 clubs, 33 nationale ploegen en 19.239 unieke spelers (19.937 selectiekoppelingen). De brondata staat in `public/data/fifa22-sofifa-220002.json` en wordt ook door de serviceworker gecachet. Niemand hoeft een bestand te downloaden of te importeren. De openbare interface bevat geen uploadvelden.

Nieuwe toernooien gebruiken een eenvoudige wizard: naam → aantal teams → teams kiezen → schema bekijken. Broninformatie staat apart onder **Teams → Over deze selectie**.

De vaste catalogus gebruikt een stabiele versie-ID. Bestaande imports blijven in de opslag staan; eerdere toernooien en hun snapshots worden niet gewijzigd. Voor nieuwe toernooien worden alleen de gekozen teams en hun spelers in een onafhankelijke snapshot opgeslagen. Zo blijven resultaten correct na toekomstige catalogusupdates en groeit de database niet onnodig met de volledige catalogus per toernooi.

Bron: [Pearlkhanna/fifa22-dataset](https://github.com/Pearlkhanna/fifa22-dataset), commit `009e95816328554c38b25b998d138f1ed7df441d`, een SoFIFA-afgeleide FIFA 22-spelersdataset. Alle oorspronkelijke speler-URL's verwijzen naar versie `220002`. De exacte selectiedatum en complete dekking van alle speelbare Kick-off-teams zijn niet bevestigd; vrouwenploegen ontbreken. Nationale ploegen zijn uitsluitend gebaseerd op expliciete `nation_team_id`-koppelingen, nooit alleen op de nationaliteit van spelers. De licentietekst van de bronrepository staat in `public/data/SOURCE-LICENSE.txt`; aanvullende provenance staat in de dataset zelf.

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
