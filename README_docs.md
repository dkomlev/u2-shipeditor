# U2 Docs v0.6 — добавление в репозиторий

Рекомендуемые пути:
- `docs/U2_Pilot_Assist_v0.6.md`
- `docs/U2_ShipConfig_v0.6.md`
- `config/shipconfig.schema.json` (обновление до v0.6)

Быстрые команды:
```bash
git switch -c docs/v0.6
mkdir -p docs config
cp docs/U2_Pilot_Assist_v0.6.md docs/U2_ShipConfig_v0.6.md ./docs/
cp config/shipconfig.schema.json ./config/
git add docs config/shipconfig.schema.json
git commit -m "docs: add Pilot Assist v0.6 and ShipConfig v0.6; update schema"
git push -u origin docs/v0.6
# создайте PR на GitHub
```
