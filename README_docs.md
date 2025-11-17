# U2 Docs helper (v0.6 / v0.7)

Этот файл описывает минимальный набор артефактов, которые нужны, чтобы подтянуть документацию под конкретную ветку кода.

### Базовый набор для ветки с ShipConfig v0.6

- `docs/U2 - Pilot Assist v0.6.3.md` или более новая версия Pilot Assist.
- `docs/U2_ShipConfig_v0.6.md` — текстовая спецификация ShipConfig.
- `config/shipconfig.schema.json` — актуальная JSON Schema под v0.6.x.

### Пример подготовки отдельной ветки с документацией

```bash
git switch -c docs/v0.6
mkdir -p docs config
cp docs/U2_Pilot_Assist_v0.6.md docs/U2_ShipConfig_v0.6.md ./docs/
cp config/shipconfig.schema.json ./config/
git add docs config/shipconfig.schema.json
git commit -m "docs: add Pilot Assist v0.6 and ShipConfig v0.6; update schema"
git push -u origin docs/v0.6
# затем открыть Pull Request на GitHub
```

При добавлении новых версий схемы или Pilot Assist рекомендуется обновлять этот файл и `docs/README.md`, чтобы зафиксировать, какие документы соответствуют какой версии кода.
