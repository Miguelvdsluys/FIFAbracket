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

De serviceworker blijft binnen het pad van deze app, cachet alleen appbestanden en verwijdert geen toernooidata. Nieuwe builds krijgen een eigen cacheversie én versienummers op scripts, stylesheets en module-imports. Dit voorkomt dat een oude geïnstalleerde app nieuwe en oude bestanden mengt. De app controleert updates bij openen, terugkeren naar de app en opnieuw verbinden. Tik op **Bijwerken** om zelf te controleren. Een gereedstaande update toont **Nu bijwerken**; het scherm wordt pas na jouw actie herladen. Open formulieren worden niet automatisch gesloten en de IndexedDB-opslag wordt niet gewist. De Node/SQLite-versie heeft geen offline serviceworker, omdat die de server nodig heeft voor opslag.

De mobiele interface heeft een vaste navigatiebalk, knoppen van minimaal 44 pixels, numerieke toetsenborden voor scores, een rondekiezer en schermvullende formulieren. Grote ranglijsten kunnen binnen hun eigen tabel horizontaal worden gescrold.

## Volledig bracket

Een toernooi opent standaard als gespiegelde toernooiboom: de eerste wedstrijden staan links en rechts, vervolgrondes lopen naar het midden en de finale staat centraal. Verbindingslijnen volgen de oorspronkelijke wedstrijdindices. Winnaars en vrijstellingen komen daardoor op dezelfde plek terecht als in de bestaande rondeweergave.

Alle wedstrijdkaarten zijn klikbaar, ook eerder bevestigde uitslagen. **Alles in beeld** past het hele schema in de beschikbare breedte; **＋ / −** vergroten of verkleinen het overzicht. Op mobiel kun je het schema in beide richtingen verschuiven of **Per ronde** kiezen voor grote invoerkaarten. De layout ondersteunt 2–32 teams, inclusief vrijstellingen. Node-tests controleren iedere kaart en verbinding; de browsercontrole test 16 teams, correcties, mobiel zoomen/scrollen en offline herladen.

## Herstel van een oude geïnstalleerde versie

Open de website eenmalig met `?update=nieuw` en start de app opnieuw. De nieuwe serviceworker neemt over zonder herinstallatie. De gewone webpagina, de geïnstalleerde app en offline gebruik krijgen dezelfde releasebestanden. Alleen appcaches worden vervangen; toernooien blijven in hun bestaande IndexedDB-opslag. Verwijder geen sitegegevens om een update te forceren.

## Beginnen voordat alle teams bekend zijn

Kies het uiteindelijke aantal plekken (2–32), maar selecteer minimaal twee teams om het toernooi te starten. Bij een gedeeltelijke start komen de eerste twee teams in een speelbare eerste wedstrijd. De overige plekken blijven leeg; ze tellen niet als vrijstelling en leveren geen fictieve resultaten op.

Tik op **Team toevoegen** in een lege plek of op **Teams aanvullen**. De teamkiezer verbergt al gebruikte teams. De oorspronkelijke catalogus wordt voor gedeeltelijke toernooien vastgelegd, zodat later toegevoegde spelers uit dezelfde selectieversie komen. Nadat alle plekken zijn ingevuld, wordt de extra catalogussnapshot opgeruimd. Toevoegen wist geen uitslagen of doelpunten. Vrijstellingen blijven uitsluitend afhankelijk van het geplande aantal teams.

Een geopend toernooi gebruikt standaard het hele beschikbare scherm, met grotere kaarten en ruimte om te verschuiven en zoomen. **Normaal venster** toont de gewone navigatie weer. Scrollpositie wordt bij het opslaan van een wedstrijd behouden.

## Club- en landenlogo's

Alle 734 teams hebben `logoUrl` en `flagUrl` uit de oorspronkelijke CSV (`club_logo_url` / `nation_logo_url`). De app toont deze bronafbeeldingen in teamkeuzes, brackets, wedstrijdformulieren en ranglijsten. Afbeeldingen worden door `cdn.sofifa.net` geleverd; de bron kan bereikbaarheid en vormgeving wijzigen. Bij een mislukte download volgt de bronvlag en daarna de initialen. De serviceworker bewaart bekeken afbeeldingen apart voor offline gebruik en raakt daarbij de toernooidatabase niet aan. Bij de allereerste offline weergave van een nog niet bekeken logo blijven de initialen beschikbaar.

## Mobiele schermweergave en lokale badges

Een toernooi opent met alleen een compacte bovenbalk en een bracket dat het resterende scherm vult. In deze weergave lopen de rondes van links naar rechts, zoals in een toernooi-editor. De grote wedstrijdregels zijn aanklikbaar; je verschuift het schema horizontaal en verticaal. Het oog toont het hele schema, het menu rechtsboven bevat zoom- en weergaveopties. In het normale venster blijft de eerdere gespiegelde opbouw beschikbaar.

Teamkeuze gebruikt een schermvullend formulier: zoeken en filters bovenaan, een grote scrollbare lijst in het midden en de volgende stap onderaan. Na kiezen wordt de zoekopdracht geleegd voor het volgende team.

Er worden nu **453 lokale afbeeldingen** meegeleverd: **420 clublogo's en vlaggen voor alle 33 nationale ploegen**. `public/data/logo-sources.json` legt de koppelingen en bronnen vast. Deze bestanden worden gepubliceerd en offline gecachet; ze zijn niet afhankelijk van de eerder onbereikbare SoFIFA-CDN. Bronnen: FCLOGO/fclogo.top, luukhopman/football-logos, qiulot/clublogos en lipis/flag-icons. De beschikbare licentieteksten zijn meegeleverd. Voor de resterende 281 clubs bestaat nog geen gecontroleerde lokale koppeling; daarvoor wordt de oorspronkelijke bron geprobeerd en blijven initialen de terugval. De selectiegegevens en spelers-ID's zijn niet veranderd.

## Teams wisselen, verwijderen en strafschoppen

In het toernooimenu staat **Teams wisselen**. Kies een teamplek en tik op een huidige deelnemer om ze om te ruilen, of op een ander team om de deelnemer te vervangen. Huidige deelnemers staan bovenaan. Ook het wedstrijdformulier heeft knoppen om de teams te wijzigen. Speelde een betrokken team al wedstrijden, dan toont de app de geraakte uitslagen en vraagt bevestiging voordat alleen die takken worden teruggezet. Niet-betrokken wedstrijden blijven staan.

Elke toernooikaart heeft een verwijderknop; dezelfde actie staat in het toernooimenu. De bevestiging vermeldt de naam en het aantal uitslagen. De ranglijsten worden na verwijderen automatisch opnieuw berekend.

Een nieuw wedstrijdformulier toont de strafschoppenvelden niet. Open ze met **＋ Strafschoppenserie**. Alleen bij een al opgeslagen serie zijn de velden bij het opnieuw openen zichtbaar. Een gelijkspel zonder beslissende serie kan nog steeds niet worden bevestigd. De serie blijft buiten de doelpuntenranglijsten.

## Soccer Aid en adidas All-Star

De door de gebruiker genoemde teams zijn als **speciale, handmatig aangemelde teams** toegevoegd. Ze zijn op naam en via **Speciale teams** vindbaar, inclusief de zoekvariant ‘adidas all stars’. Hun historische FIFA 22-selecties zijn **niet geverifieerd**: de netwerkproxy blokkeert FIFA Index, SoFIFA, FIFA CM en EA met CONNECT 403. Zoekpogingen via beschikbare GitHub-bronnen leverden geen betrouwbare speciale FIFA 22-rosters op. Er zijn daarom geen legenden of spelerskoppelingen verzonnen. Doelpunten kunnen voorlopig als onbekend worden geregistreerd.

Er is een aanvullende netwerkallowlist opgeslagen in het omgevingsconcept voor `www.fifaindex.com`, `fifaindex.com`, `sofifa.com`, `www.fifacm.com` en `www.ea.com`. Dit concept is niet vanzelf actief; na activeren kan bronverificatie worden hervat. De bestaande clubs, nationale selecties, spelers-ID's en eerdere toernooisnapshots zijn behouden.
