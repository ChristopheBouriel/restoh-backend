# Troubleshooting: Apple Devices Cannot Access Website Abroad

**Date**: 3 Février 2026
**Contexte**: Accès impossible au site RestOh depuis des appareils Apple (iPhone, iPad, Mac) au Laos, alors que ça fonctionne sur d'autres appareils/pays.

---

## Symptômes

- Tous les navigateurs affectés (Safari, Chrome, Firefox, Opera)
- Tous les appareils Apple affectés (iPhone, iPad, Mac)
- Fonctionne en Thaïlande mais pas au Laos
- Les appareils non-Apple sur le même réseau fonctionnent (à vérifier)

---

## Causes Probables

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

**À vérifier après tests** :
- [ ] Private Relay désactivé résout le problème ?
- [ ] DNS manuel résout le problème ?
- [ ] App 1.1.1.1 résout le problème ?
- [ ] Problème uniquement sur Wi-Fi ou aussi en cellulaire ?
- [ ] Quel navigateur/appareil testé ?

---

*Document créé le 3 février 2026*
