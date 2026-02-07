# Instrukcja uruchomienia aplikacji Electronic Parts

Aplikacja to prosty serwer Node.js, który wczytuje dane z pliku `ElectronicParts.csv` i wyświetla kategorie oraz listę części z miniaturami obrazków (z Wikipedii lub placeholder).

## Wymagania

- Zainstalowany **Node.js** (wersja 16 lub nowsza). Sprawdź: `node --version`.

## Uruchomienie krok po kroku

### 1. Otwórz terminal w folderze projektu

Przejdź do katalogu z projektem (tam, gdzie leży `ElectronicParts.csv` i `app.js`):

```bash
cd /Users/mrnz/Desktop/work/Electronic
```

### 2. Zainstaluj zależności

W katalogu projektu uruchom:

```bash
npm install
```

Zostaną doinstalowane pakiety: `express`, `csv-parse`.

### 3. Uruchom serwer

```bash
npm start
```

Alternatywnie:

```bash
node app.js
```

W terminalu powinna pojawić się linia:

```
Aplikacja działa pod adresem: http://localhost:5000
```

### 4. Otwórz aplikację w przeglądarce

W przeglądarce wejdź na:

**http://localhost:5000**

- **Strona główna (/)** – lista unikalnych kategorii (przyciski/linki).
- **Kliknięcie w kategorię** – otwiera się podstrona `/category/<nazwa_kategorii>` z tabelą elementów: miniatura obrazka, nazwa, kategoria, ilość, opis.

### 5. Zatrzymanie serwera

W terminalu naciśnij **Ctrl+C**.

---

## Skrót (jedna komenda po instalacji)

Po pierwszym `npm install` wystarczy za każdym razem:

```bash
npm start
```

i wejść w przeglądarce na **http://localhost:5000**.
