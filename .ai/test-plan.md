# Plan testów – 10xCookbook

## 1. Wprowadzenie i cele testów
10xCookbook to aplikacja webowa służąca do szybkiego przekształcania nieustrukturyzowanego tekstu przepisu w jednolitą, edytowalną strukturę w osobistej książce kucharskiej. Celem procesu testowego jest zapewnienie:
- Integralności danych (przepisy, tagi, obrazy, sesje, zdarzenia analityczne).
- Niezawodności i dostępności głównych przepływów (rejestracja, logowanie, tworzenie/edycja przepisu, parsowanie AI, zapis, usuwanie).
- Spełnienia wymagań funkcjonalnych (PRD, limity: ≤50 składników, opis przygotowania ≤5 000 znaków, walidacja obrazów).
- Docelowej wydajności (parsowanie AI median <6 s, timeout 10 s z łagodnym fallbackiem).
- Bezpieczeństwa (RLS / polityki Supabase, kontrola sesji, brak wycieku PII poza email).
- Dostępności (WCAG AA w kluczowych komponentach, obsługa klawiatury, poprawne alt text).
- Prawidłowości telemetrii (zdarzenia analityczne i parametry).

## 2. Zakres testów
W zakres wchodzą:
- Warstwa frontend (Astro + React + TypeScript): komponenty UI, tryby preview vs. edit.
- Warstwa usług (`lib/services`): parsowanie AI, upload obrazów, analityka, cookbook/recipe/tag services, rate limiting.
- Endpoints API (`pages/api/...`): autoryzacja, przepisy, tagi, obrazy, analityka, AI parse, sesje.
- Warstwa walidacji (`validation/*.ts`).
- Integracja z Supabase (auth, RLS, migracje, seeding tagów).
- Integracja z usługą Openrouter (limity, poprawne parametry, fallback na błędy sieciowe).
- Migracje bazy danych (spójność schematu, zgodność nazewnictwa, funkcje/triggery).
Poza zakresem: funkcje społecznościowe, transformacje dietetyczne, wieloregionowe skalowanie, zaawansowane wyszukiwanie (MVP nie obejmuje).

## 3. Rodzaje testów
1. Testy jednostkowe (Unit):
   - Walidatory (np. `recipe.validator.ts`, `ingredient.validator.ts`, `auth.validator.ts`).
   - Logika hooków (np. `useAIParse`, `useRecipeForm`, `useImageUpload`).
   - Funkcje serwisowe (parsowanie, normalizacja obrazu, emisja zdarzeń analitycznych, rate limit).
2. Testy komponentów (React/Astro):
   - Formularze auth, RecipeForm, AIDraftPreview, interakcja tagów, BookLayout.
3. Testy integracyjne:
   - Połączenia między endpointami API a serwisami oraz bazą (Supabase klient + RLS).
   - Przepływ AI parse: wywołanie endpointu `/api/ai/parse` → serwis → odpowiedź.
4. Testy end-to-end (E2E):
   - Główne scenariusze użytkownika (rejestracja, logowanie, stworzenie przepisu z AI i bez AI, edycja, usuwanie, upload obrazu, tagowanie).
5. Testy wydajnościowe:
   - Czas parsowania AI (próbki statystyczne, mediany, timeout handling).
   - Obciążenie endpointu zapisu przepisu (RPS vs. stabilność, RU zużycie w PostgreSQL/Supabase – przybliżone).
6. Testy bezpieczeństwa:
   - RLS – brak dostępu do zasobów innych użytkowników.
   - Próby nieautoryzowanego wywołania endpointów (cookbooks/recipes/tags). 
   - Siła haseł, próby brute-force (rate limit / blokada).
7. Testy dostępności (A11y):
   - Focus order, aria-labels, kontrast, alt text auto + nadpisanie.
8. Testy regresji:
   - Po każdej migracji bazy i zmianie schematu.
9. Testy kompatybilności:
   - Nowe wersje Astro / React – smoke test.
10. Testy odporności (resilience/fallback):
    - Timeout AI, błąd sieci Openrouter, przerwanie uploadu obrazu.
11. Testy jakości danych analitycznych:
    - Zdarzenia z poprawnymi parametrami (np. `duration_ms`, `ingredient_count`).
12. Testy migracji bazy:
    - Spójność kolejności, brak duplikatów, poprawne rename kolumn (migration 20251102000700).

## 4. Scenariusze testowe (kluczowe)
Pogrupowane wg funkcjonalności (skrócony katalog – pełna lista w repo testów). 

### Autoryzacja / Sesje
- Rejestracja (poprawny email + silne hasło) → `registration_complete` event.
- Rejestracja z błędnym e-mailem (walidacja klient + serwer) – komunikat błędu.
- Logowanie poprawne → sesja aktywna, `login_success` event.
- Logowanie z błędnym hasłem → brak sesji, komunikat.
- Wylogowanie → `session_end` event (manual + unload symulacja).
- Migrate sesji anonimowej do zarejestrowanej (endpoint `sessions/migrate`).

### Tworzenie przepisu (Manual)
- Wprowadzenie tytułu, ≤50 składników, opis ≤5 000 znaków → sukces `recipe_save` (is_ai_assisted=false).
- Przekroczenie limitu składników (51) → blokada dodania kolejnego + komunikat ostrzegawczy.
- Brak tytułu → disabled przycisk zapisu + lista błędów.
- Duplikaty nazw składników → ostrzeżenie, zapis możliwy.

### Parsowanie AI
- Wywołanie `Parse with AI` z poprawnym tekstem → draft w prawym panelu, `recipe_parse_success` (duration_ms, ingredient_count).
- Timeout >10 s – symulacja (mock) → komunikat błędu, `recipe_parse_timeout`, zachowany tekst po lewej.
- Błąd API Openrouter (500 / network) → fallback, `recipe_parse_error`.
- Ponowne parsowanie po poprawkach – aktualizacja draftu.

### Edycja / Usuwanie przepisu
- Edycja istniejącego przepisu – aktualizacja `updated_at`, `recipe_edit` event.
- Usunięcie przepisu (modal potwierdzenia) → `recipe_delete` event.
- Próba edycji przepisu innego użytkownika → odmowa (RLS).

### Tagowanie
- Pobranie listy tagów (seed) – wyświetlenie w UI.
- Dodanie/Usunięcie tagu → stan zaznaczenia odzwierciedlony w zapisanym przepisie.
- Automatyczna sugestia (np. „quick”) przez AI → możliwość ręcznej zmiany.

### Obrazy
- Upload PNG 800×600 1.2MB → przetworzenie do kwadratu WebP, podgląd miniatury.
- Przekroczenie limitu rozmiaru (>2MB) → błąd walidacji.
- Obraz 2000×2000 → odrzucenie (weryfikacja wymiarów).
- Przerwanie uploadu (abort) → brak zapisu, komunikat.
- Alt text automatycznie z tytułu; zmiana przez użytkownika → zapis nowej wartości.

### Widoki i nawigacja
- Tryb preview: brak pól edycyjnych, poprawne rozłożenie na dwie strony.
- Przejście preview → edit → preview (stan zachowania danych).
- Nawigacja między listą przepisów a widokiem szczegółowym; skeleton loader wczytuje się poprawnie.

### Analityka
- Emisja wszystkich zdarzeń w docelowych punktach (porównanie sekwencji z PRD).
- Parametry zdarzeń zgodne z typami (np. integer vs string) – walidatory analityki.
- Brak duplikatów przy powtórnej emisji (np. parse retry loguje nowe `recipe_parse_requested`).

### Bezpieczeństwo / RLS / Rate limiting
- Próba dostępu do przepisu innego użytkownika – 403 / brak danych.
- Próba masowego spamowania endpointu AI parse – aktywacja rate limit (429 + komunikat).
- SQL injection w polach formularza – brak ekspozycji (walidacja + parametryzacja).

### Migracje DB
- Uruchomienie wszystkich migracji na czystej bazie → sukces bez konfliktów.
- Idempotentne odtworzenie środowiska lokalnego.
- Sprawdzenie kolumn po rename (`description` → `preparation_description`).

### Fallback / Odporność
- Utrata sieci podczas zapisu przepisu – komunikat + możliwość ponowienia.
- Utrata sieci podczas pobierania tagów – fallback pusty + komunikat.

### Dostępność
- Tab order: formularz logowania, RecipeForm, TagDropdown.
- Kontrast kluczowych tekstów (narzędzie Axe). 
- Aria-labels w przyciskach akcji (Parse, Save, Delete, Logout). 

## 5. Środowisko testowe
- Lokalnie: Supabase (lokalna instancja / hosted), emulator Auth, dane seed (tags). 
- Staging (DigitalOcean): kopia produkcyjnej konfiguracji, mniejsza skala, testy E2E i wydajnościowe.
- Narzędzia CI (GitHub Actions) uruchamiają zestawy: unit + integracja + lint + typy.
- Konfiguracja zmiennych środowiskowych: klucze Openrouter (ograniczone limity testowe), klucze Supabase (public + service role tylko w testach kontrolowanych).

## 6. Narzędzia testowe
- Unit/Integracja: Vitest (TS) + React Testing Library.
- E2E: Playwright (CI: headless, lokalnie: headed dla debugowania).
- Dostępność: axe-core (integracja z Playwright + komponenty), manualne kontrole klawiatury.
- Wydajność: k6 / Artillery (API parse, recipe save), manualne pomiary czasu w testach integracyjnych.
- Pokrycie kodu: c8 (raport w CI, threshold min. 70% logicznego kodu usług + walidacji).
- Analiza obrazów: biblioteka `sharp` (testy transformacji – mock w unit, real w integracji off-line).
- Static analysis: ESLint + TypeScript type checking.
- Bezpieczeństwo: OWASP zapytania testowe (manual), skan zależności `npm audit`.

## 7. Harmonogram testów (MVP – 2 tygodnie)
| Dzień | Aktywność |
|-------|-----------|
| 1–2   | Analiza wymagań, przygotowanie szkieletu testów unit + walidatory |
| 3–4   | Testy komponentów UI (auth, recipe form, AI draft preview) |
| 5–6   | Testy integracyjne API (auth, recipes, tags, images, AI parse) |
| 7     | E2E główne przepływy (rejestracja, stworzenie przepisu manual + AI) |
| 8     | E2E edycja/usunięcie, sesje anonim → migracja |
| 9     | Wydajność (AI parse, zapisy), bezpieczeństwo (RLS, rate limit) |
| 10    | Dostępność + telemetria zdarzeń |
| 11    | Regresja po migracjach + stabilizacja |
| 12    | Uzupełnienie braków / pokrycia, raport ryzyka |
| 13    | Poprawki krytyczne, re-test |
| 14    | Finalizacja: raport końcowy, exit criteria check |

## 8. Kryteria akceptacji testów (Exit Criteria)
- Wszystkie testy krytyczne (autoryzacja, tworzenie/edycja/zapis przepisu, AI parse fallback) zielone.
- Mediana parsowania AI <6 s (w próbce ≥30 wywołań na staging). 
- Brak blokujących (Severity 1) i maks. 2 otwarte wysokie (Severity 2) defekty z zaakceptowanym planem naprawy.
- Pokrycie testów logicznych usług + walidatorów ≥70% linii.
- Wdrożone testy a11y (≥95% kluczowych ścieżek bez krytycznych błędów kontrastu/focus).
- Zdarzenia analityczne poprawne (≥95% prób z prawidłowym schematem i parametrami). 
- Wszystkie migracje DB przechodzą od zera bez błędów.

## 9. Role i odpowiedzialności
- QA Engineer: tworzenie i utrzymanie testów, analiza ryzyka, raportowanie defektów, metryki wydajności.
- Backend Dev: naprawa błędów w API, walidacjach, migracjach, wsparcie testów integracyjnych.
- Frontend Dev: naprawa błędów UI/UX, dostępność, regresja komponentów.
- DevOps: konfiguracja środowisk (staging), optymalizacja CI, tajemnice środowiskowe.
- Product Owner: priorytetyzacja defektów, akceptacja kryteriów wyjścia.

## 10. Procedury zgłaszania błędów
1. Rejestracja defektu w GitHub Issues (szablon: tytuł, kroki odtworzenia, oczekiwany wynik, rzeczywisty wynik, logi, zrzuty ekranu). 
2. Klasyfikacja Severity:
   - S1 Krytyczny: blokuje główne przepływy (np. brak możliwości zapisu przepisu). 
   - S2 Wysoki: znaczące ograniczenie funkcji (np. brak parsowania AI bez fallbacku). 
   - S3 Średni: funkcja działa z degradacją (np. wolniejsze parsowanie >8 s). 
   - S4 Niski: kosmetyczne problemy (literówki, drobne UX).
3. Priorytetyzacja: QA + PO ustalają kolejność naprawy (S1 natychmiast, S2 w ciągu 24h, S3 w backlog sprintu, S4 opcjonalnie). 
4. Śledzenie: statusy (Open → In Progress → In Review → Resolved → Closed). 
5. Weryfikacja naprawy: retest + regresja powiązanych modułów.
6. Komunikacja: codzienny skrót defektów (liczba nowych, zamkniętych, otwartych S1/S2). 
7. Konwencje commitów: użycie Conventional Commits (fix:, feat:, test:, chore:) – powiązanie z numerem Issue.

---

## Załączniki / Odniesienia
- PRD: `.ai/prd.md`
- Stack: `.ai/tech-stack.md`
- Migracje: `supabase/migrations/*`
- Usługi i walidatory: `src/lib/services`, `src/lib/validation`
- Endpointy: `src/pages/api/*`

## Metryki monitorowane (po wdrożeniu)
- Średni czas parsowania AI (prometheus/logowanie).
- Współczynnik błędów 4xx/5xx API (<2%).
- Liczba unikalnych recept użytkowników vs. cel aktywacji.
- Spójność emisji zdarzeń (brak brakujących kluczowych eventów).

## Ryzyka i strategie mitigacji (podsumowanie)
| Ryzyko | Strategie |
|--------|-----------|
| Wysoki czas parsowania AI | Testy wydajnościowe, cache promptów, analiza trace. |
| Utrata danych w edycji | Autosave / utrzymanie stanu w pamięci komponentu, testy przejść między widokami. |
| Błędy w migracjach | Automatyczne testy integracyjne po uruchomieniu migracji od zera. |
| Niepoprawne limity składników/opisu | Jednostkowe walidatory + E2E w RecipeForm. |
| Nieszczelny RLS | Negatywne testy dostępu do cudzych zasobów. |
| Niekompletna analityka | Testy emisji + walidacja schematu zdarzeń. |
| Niedostępność (a11y) | Playwright + axe, manualny review fokus. |

## Utrzymanie planu
Plan aktualizowany przy każdej większej zmianie architektury (np. nowe typy zasobów, dodatkowe tryby UI). QA monitoruje pokrycie i dostosowuje priorytety w backlogu testowym.
