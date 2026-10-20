# Reprise explicite — complément de #27 / daemon #158

La revue et le résumé de tâche disposent d’une section fermée par défaut : checkpoint, tour, sous-tâches et opérations interrompues. Une opération inconnue peut recevoir une décision humaine après inspection, avec choix explicite et note obligatoire. Le daemon refuse la résolution pendant une exécution active ou hors état arrêté. Aucune commande n’est rejouée et aucune reprise n’est déclenchée par cette décision.

Les questions en attente sont historiques : elles ne valent pas approbation. Le bouton de reprise existant reste une action distincte. Le prompt complet n’est pas demandé par l’interface.

`npm run build` : OK. Aucun parcours réel de pause/crash/reprise ni test local ; les recettes sont dans le document daemon `spec/dev/integrations/studio-durable-recovery.md` et reliées à #143. Le ticket reste ouvert jusqu’à validation.
