#!/bin/zsh
# Installe une tâche planifiée qui vérifie les alertes toutes les 30 min (9h-18h, lun-ven)

PYTHON="/Library/Developer/CommandLineTools/usr/bin/python3"
SCRIPT="/Users/matteomoulinet/stock-analyzer/check_alerts.py"
LOG="/Users/matteomoulinet/stock-analyzer/alerts.log"

SCAN_SCRIPT="/Users/matteomoulinet/stock-analyzer/scan_opportunities.py"
SCAN_LOG="/Users/matteomoulinet/stock-analyzer/scan.log"

CRON_ALERTS="*/30 9-18 * * 1-5 $PYTHON -W ignore $SCRIPT >> $LOG 2>&1"
CRON_SCAN="30 9 * * 1-5 $PYTHON -W ignore $SCAN_SCRIPT >> $SCAN_LOG 2>&1"

# Ajoute les lignes seulement si elles n'existent pas déjà
(crontab -l 2>/dev/null \
  | grep -v "check_alerts.py" \
  | grep -v "scan_opportunities.py"
  echo "$CRON_ALERTS"
  echo "$CRON_SCAN"
) | crontab -

echo "✅ Tâches planifiées installées."
echo "   • Alertes prix     : toutes les 30 min, 9h–18h, lun–ven"
echo "   • Scan opportunités : chaque matin à 9h30, lun–ven"
echo ""
echo "Pour vérifier : crontab -l"
echo "Pour désinstaller : crontab -e  (supprimer les lignes stock-analyzer)"
