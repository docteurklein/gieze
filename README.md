# gieze

```sh
helm repo add cnpg https://cloudnative-pg.github.io/charts
helm upgrade --install cnpg \
  --namespace cnpg-system \
  --create-namespace \
  cnpg/cloudnative-pg


k create ns gieze

k create configmap --from-file nginx/public/ nginx-public
k create configmap --from-file nginx/public/images nginx-images
k create configmap --from-file nginx/public/vendor nginx-vendor

k create secret generic postgrest-jwt-secret --from-literal secret=$(openssl rand -hex 32)

k apply -f postgres/cluster.yaml
k apply -f postgrest
k apply -f nginx/nginx.yaml
```
