# Troubleshooting: Apple Devices Cannot Access Website Abroad

**Date**: 3 Février 2026
**Contexte**: Accès impossible au site RestOh depuis des appareils Apple (iPhone, iPad, Mac) au Laos, alors que ça fonctionne sur d'autres appareils/pays.

---

## Symptômes

- Tous les navigateurs affectés (Safari, Chrome, Firefox, Opera)
- Tous les appareils Apple affectés (iPhone, iPad, Mac)
- Fonctionne en Thaïlande mais pas au Laos
- **IMPORTANT : Les appareils Android et PC Windows sur le MÊME réseau Wi-Fi fonctionnent**
- Messages d'erreur :
  - Safari : "Safari ne peut pas ouvrir la page car aucune connexion sécurisée au serveur n'a pu être établie"
  - Firefox : `NSURLErrorDomain`
  - Chrome : Timeout
- Cloudflare WARP ne peut pas se connecter non plus ("périphérique n'a pas pu établir de connexion")

---

## Causes Probables

### HYPOTHÈSE PRINCIPALE : IPv6 "Happy Eyeballs" Défaillant

Le fait que **Android/PC fonctionnent mais pas Apple sur le même réseau** pointe vers une différence dans la gestion IPv6/IPv4 :

**"Happy Eyeballs"** est l'algorithme qu'Apple utilise pour choisir entre IPv6 et IPv4 :
1. Apple préfère IPv6 et essaie d'abord en IPv6
2. Si IPv6 échoue, il devrait basculer vers IPv4
3. **MAIS** : Si le réseau a une configuration IPv6 "cassée" (IPv6 annoncé mais non fonctionnel vers Internet), Apple peut rester bloqué

**Pourquoi Android/Windows fonctionnent** : Ils ont des implémentations différentes de Happy Eyeballs, souvent plus agressives pour basculer vers IPv4.

**Sources** :
- [Apple Developer Forums - Happy Eyeball broken in iOS 16](https://developer.apple.com/forums/thread/739087)
- [APNIC - Revisiting Apple and IPv6](https://blog.apnic.net/2015/07/15/revisiting-apple-and-ipv6/)

---

### 1. Fonctionnalités de Confidentialité Apple Combinées

Apple a plusieurs couches de protection de la vie privée qui peuvent interférer ensemble :

| Fonctionnalité | Description | Problème potentiel |
|----------------|-------------|-------------------|
| **iCloud Private Relay** | Routage du trafic via les serveurs Apple/Cloudflare | Bloqué dans certains pays, IP partagées bloquées par WAF |
| **Limit IP Address Tracking** | Masque l'adresse IP pour le tracking | Bypass les DNS configurés manuellement |
| **Private Wi-Fi Address** | Adresse MAC aléatoire par réseau | Problèmes avec certains routeurs/réseaux |

**Source**: [University of Miami IT - Apple Privacy Features](https://www.it.miami.edu/about-umit/it-news/umit-announcements/macos-sequoia-private-wifi-addresses/index.html)

### 2. DNS Chiffré (DoH/DoT) Bloqué

Apple utilise le DNS chiffré par défaut depuis iOS 14 / macOS Big Sur :
- **DoT (DNS over TLS)** : Port 853 - facilement bloqué par les ISP
- **DoH (DNS over HTTPS)** : Port 443 - plus difficile à bloquer

Si le réseau local bloque ces protocoles, les requêtes DNS peuvent échouer silencieusement.

**Source**: [Astrill VPN - This Network is Blocking Encrypted DNS Traffic](https://www.astrill.com/blog/this-network-is-blocking-encrypted-dns-traffic/)

### 3. Cloudflare WAF Bloquant Private Relay

Cloudflare (utilisé par Cloudflare Pages pour le frontend) peut bloquer les adresses IP de Private Relay car :
- Plusieurs utilisateurs partagent la même IP
- Similaire à un proxy public (souvent bloqué pour sécurité)

**Source**: [Apple Community - Cloudflare blocked my Private Relay IP](https://discussions.apple.com/thread/255603045)

### 4. mDNSResponder (DNS Resolver Apple) Dysfonctionnel

Le daemon mDNSResponder d'Apple peut parfois cesser de fonctionner correctement, affectant tous les navigateurs.

**Source**: [Apple Community - DNS Resolution Failure](https://discussions.apple.com/thread/253361594)

### 5. Disponibilité Régionale de Private Relay

Private Relay n'est pas disponible dans tous les pays. Quand tu voyages vers un pays non supporté, il se désactive automatiquement. Quand tu reviens, il se réactive.

**Pays où Private Relay n'est PAS disponible** : Biélorussie, Chine, Colombie, Égypte, Kazakhstan, Arabie Saoudite, Afrique du Sud, Turkménistan, Ouganda, Philippines.

Le Laos n'est pas dans cette liste, mais le comportement peut être imprévisible.

**Source**: [Apple Insider - iCloud Private Relay not available in certain countries](https://appleinsider.com/articles/21/06/08/apples-icloud-private-relay-feature-not-available-in-belarus-china-uganda-other-countries)

---

## Solutions (Par Ordre de Priorité)

### Solution 0 : Forcer IPv4 (NOUVELLE PISTE PRIORITAIRE)

Si le problème est lié à IPv6, forcer l'utilisation d'IPv4 devrait résoudre le problème.

#### Sur iPhone / iPad

**Option A - Désactiver IPv6 dans les paramètres Wi-Fi** :
```
Réglages → Wi-Fi → (i) à côté du réseau → Configurer IP → Manuel
```
Entrer manuellement une IP IPv4 (demander au routeur ou utiliser DHCP puis noter l'IP).

**Option B - Utiliser un DNS IPv4 uniquement** :
```
Réglages → Wi-Fi → (i) → Configurer le DNS → Manuel
```
Supprimer tous les serveurs DNS existants et ajouter uniquement :
- `8.8.8.8`
- `8.8.4.4`

#### Sur Mac

**Désactiver IPv6 complètement** :
```
Réglages Système → Réseau → Wi-Fi → Détails → TCP/IP
→ Configurer IPv6 → "Lien local uniquement" (ou "Link-local only")
```

**Ou via Terminal** :
```bash
sudo networksetup -setv6off Wi-Fi
```

Pour réactiver plus tard :
```bash
sudo networksetup -setv6automatic Wi-Fi
```

**Source** : [Apple Community - IPv6 disabling](https://discussions.apple.com/thread/255764220)

---

### Solution 1 : Désactiver TOUTES les Fonctionnalités de Confidentialité Apple

C'est la solution la plus complète à essayer en premier.

#### Sur iPhone / iPad

**1. Désactiver Private Relay**
```
Réglages → [Ton nom] → iCloud → Private Relay → Désactiver
```

**2. Désactiver "Limiter le suivi de l'adresse IP" (Wi-Fi)**
```
Réglages → Wi-Fi → Tap sur (i) à côté du réseau connecté
→ Désactiver "Limiter le suivi de l'adresse IP"
```

**3. Désactiver "Adresse Wi-Fi privée"**
```
Même écran que ci-dessus
→ Adresse Wi-Fi privée → Désactiver (ou choisir "Fixe")
```

**4. Désactiver "Limiter le suivi de l'adresse IP" (Cellulaire)**
```
Réglages → Données cellulaires → Options des données cellulaires
→ Désactiver "Limiter le suivi de l'adresse IP"
```

#### Sur Mac

**1. Désactiver Private Relay**
```
Réglages Système → [Ton nom] → iCloud → Private Relay → Désactiver
```

**2. Désactiver "Limiter le suivi de l'adresse IP"**
```
Réglages Système → Réseau → Wi-Fi → Détails (à côté du réseau)
→ Désactiver "Limiter le suivi de l'adresse IP"
```

**3. Désactiver "Adresse Wi-Fi privée"**
```
Même écran → Désactiver "Adresse Wi-Fi privée"
```

---

### Solution 2 : Configurer DNS Manuellement

Utiliser les DNS publics de Cloudflare ou Google pour bypasser les problèmes DNS locaux.

#### Sur iPhone / iPad
```
Réglages → Wi-Fi → (i) à côté du réseau → Configurer le DNS → Manuel
```
Ajouter les serveurs :
- `1.1.1.1` (Cloudflare)
- `1.0.0.1` (Cloudflare secondaire)
- `8.8.8.8` (Google)
- `8.8.4.4` (Google secondaire)

#### Sur Mac
```
Réglages Système → Réseau → Wi-Fi → Détails → DNS
```
Cliquer sur `+` et ajouter les mêmes adresses.

---

### Solution 3 : Installer l'App Cloudflare 1.1.1.1

L'application 1.1.1.1 de Cloudflare peut contourner les blocages DNS et offre un mode WARP (mini-VPN gratuit).

**Installation** :
1. Télécharger depuis l'App Store : [1.1.1.1: Faster Internet](https://apps.apple.com/app/1-1-1-1-faster-internet/id1423538627)
2. Ouvrir l'app et autoriser l'installation du profil VPN
3. Activer le mode "WARP" pour un chiffrement complet

**Documentation** : [Cloudflare 1.1.1.1 Setup iOS](https://developers.cloudflare.com/1.1.1.1/setup/ios/)

---

### Solution 4 : Vider le Cache DNS

#### Sur Mac
```bash
sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder
```

#### Sur iPhone / iPad
- Activer puis désactiver le **Mode Avion**
- Ou redémarrer l'appareil

---

### Solution 5 : Tester avec un Autre Réseau

Pour isoler si le problème vient du réseau spécifique :

1. **Essayer en données cellulaires** (désactiver Wi-Fi)
2. **Essayer un autre réseau Wi-Fi** (café, restaurant, etc.)
3. **Partage de connexion** depuis un appareil non-Apple (si disponible)

---

### Solution 6 : Utiliser un VPN

Si les solutions ci-dessus ne fonctionnent pas, un VPN peut contourner tous les blocages réseau :

**VPN recommandés** :
- NordVPN
- ExpressVPN
- Surfshark
- ProtonVPN (option gratuite)

---

## Pourquoi Ça Marchait en Thaïlande ?

Plusieurs hypothèses :

1. **Private Relay désactivé automatiquement** - Si la Thaïlande était considérée comme non supportée temporairement
2. **ISP différent** - L'ISP thaïlandais ne bloquait pas le DNS chiffré
3. **Réseau différent** - Hôtel/café avec configuration réseau plus permissive
4. **Adresse IP différente** - Pas flaggée par Cloudflare WAF

---

## Vérifications Supplémentaires

### Vérifier si Private Relay est Actif
```
Réglages → [Ton nom] → iCloud → Private Relay
```
Si tu vois "Private Relay est désactivé pour votre région", c'est que le pays ne le supporte pas.

### Vérifier les Alertes Réseau
Si tu vois le message **"Ce réseau bloque le trafic DNS chiffré"** dans les paramètres Wi-Fi, c'est confirmation que le DNS chiffré est bloqué.

### Tester l'Accès Direct à l'API
Essayer d'accéder directement au backend :
```
https://restoh-backend.onrender.com/api/menu
```
Si ça fonctionne mais pas le frontend, le problème est spécifique à Cloudflare Pages.

---

## Références

- [Apple Support - About iCloud Private Relay](https://support.apple.com/en-us/102602)
- [Apple Support - Use private Wi-Fi addresses](https://support.apple.com/en-us/102509)
- [Apple Support - Manage iCloud Private Relay](https://support.apple.com/en-us/102022)
- [TidBITS - Solving Connectivity Problems Caused by Interlocking Apple Privacy Settings](https://tidbits.com/2022/06/20/solving-connectivity-problems-caused-by-interlocking-apple-privacy-settings/)
- [Cloudflare - iCloud Private Relay: What Customers Need to Know](https://blog.cloudflare.com/icloud-private-relay/)
- [Apple Developer Forums - DNS encryption blocked](https://developer.apple.com/forums/thread/661116)

---

## Notes de Session

**Tests effectués le 3 février 2026** :
- [x] Private Relay désactivé → **Aucun effet**
- [x] Limit IP Address Tracking désactivé → **⚠️ CASSE TOUT - NE PAS FAIRE**
- [x] Private Wi-Fi Address désactivé → **Aucun effet**
- [x] Données cellulaires (pas Wi-Fi) → **Même problème**
- [x] App 1.1.1.1 avec WARP → **WARP ne peut pas se connecter**
- [x] DNS manuel (8.8.8.8) → **A empiré les choses**
- [x] Reset réseau → **A nécessité de tout reconfigurer**

**⚠️ DÉCOUVERTE CRITIQUE :**

**"Limiter le suivi de l'adresse IP" DOIT rester activé (ON) !**

Cette option fait passer le trafic Safari via les serveurs proxy d'Apple, ce qui contourne le blocage ISP au Laos. La désactiver expose le trafic directement à l'ISP local → bloqué.

**État actuel (après restauration) :**
| Appareil/Navigateur | Fonctionne ? | Notes |
|---------------------|--------------|-------|
| Safari iPhone | ✅ OUI | Avec "Limiter le suivi IP" = ON |
| Chrome iPhone | ❌ NON | L'option ne s'applique qu'à Safari |
| Firefox iPhone | ❌ NON | L'option ne s'applique qu'à Safari |
| Safari Mac | ❌ NON | Option différente sur macOS |
| Autres navigateurs Mac | ❌ NON | - |

**Observations clés** :
- Android et PC Windows fonctionnent sur le même réseau Wi-Fi
- Le backend Render directement (`restoh-backend.onrender.com`) ne fonctionne pas (sauf Safari iOS)
- L'ISP au Laos bloque apparemment Cloudflare Pages et Render
- Le proxy Apple (via "Limiter le suivi IP") contourne ce blocage pour Safari iOS uniquement

**Conclusion** : Le problème est un blocage au niveau de l'ISP au Laos, pas un problème Apple. La fonctionnalité de confidentialité Apple agit comme un VPN de contournement pour Safari uniquement.

---

## SOLUTION FINALE : ProtonVPN (4 février 2026)

Après avoir cassé la configuration qui fonctionnait en essayant de comprendre pourquoi, la solution finale est d'utiliser **ProtonVPN**.

### Installation

1. **Créer un compte** sur [protonvpn.com](https://protonvpn.com) (gratuit)
2. **Installer sur Mac** : Télécharger depuis le site ou l'App Store
3. **Installer sur iPhone** : App Store → ProtonVPN
4. **Se connecter** avec le même compte sur les deux appareils

### Limitation du plan gratuit

- **1 seul appareil connecté à la fois**
- Pour switcher : déconnecter sur un appareil, connecter sur l'autre
- Pas de limite sur le nombre d'appareils où l'app est installée

### Astuce : Partage de connexion

Pour couvrir Mac ET iPhone avec une seule connexion VPN :

1. Connecter ProtonVPN sur le Mac
2. Activer le partage de connexion :
   ```
   Réglages Système → Général → Partage → Partage Internet
   ```
3. Partager depuis : Wi-Fi (avec VPN actif)
4. Vers : iPhone (via Wi-Fi ou USB)

Ainsi les deux appareils bénéficient du VPN avec une seule "connexion" ProtonVPN.

### Serveurs recommandés depuis le Laos

- Japon (plus proche, rapide)
- Singapour
- Tout serveur disponible sur le plan gratuit

### Résultat

✅ **Tous les navigateurs fonctionnent** (Safari, Chrome, Firefox)
✅ **Mac et iPhone couverts**
✅ **Solution stable et fiable**

---

## Historique des Modifications

| Date | Modification |
|------|-------------|
| 3 fév 2026 | Création du document |
| 3 fév 2026 | Ajout hypothèse IPv6 Happy Eyeballs après recherches approfondies |
| 3 fév 2026 | Ajout Solution 0 (forcer IPv4) comme priorité |
| 3 fév 2026 | Mise à jour des tests effectués |
| 3 fév 2026 | Découverte critique : "Limiter le suivi IP" doit rester ON |
| 4 fév 2026 | **SOLUTION FINALE** : ProtonVPN fonctionne parfaitement |

---

## Leçons Apprises

1. **Ne jamais modifier une config qui fonctionne** pour "comprendre pourquoi" - documenter d'abord
2. **Les paramètres Apple peuvent être instables** - désactiver/réactiver ne garantit pas de revenir à l'état initial
3. **L'ISP au Laos bloque Cloudflare Pages et Render** - c'est un blocage réseau, pas un problème Apple
4. **Un VPN commercial est la solution la plus fiable** pour contourner les blocages ISP

---

*Dernière mise à jour : 4 février 2026*
