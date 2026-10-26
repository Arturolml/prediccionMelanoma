# Solo necesitamos Nube o Servidor para construir la app, sin Nginx, ya que lo tienes a nivel SO
FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias
RUN npm install

# Copiar código fuente
COPY . .

# Comando por defecto, en tu servidor Nginx nativo simplemente deberas apuntar 
# el root de liaaproyectos.uaz.edu.mx a la carpeta /dist que este contenedor genere.
# Sin embargo, como pediste dockerizarlo pero SIN nginx adentro, este contenedor
# simplemente generara el build en un volumen compartido o puedes usar un servidor Node estatico ligero.
# Una solucion elegante es usar `serve` para servir la carpeta dist en el puerto 8080:

ARG VITE_API_URL
ENV VITE_API_URL=$VITE_API_URL

RUN npm install -g serve
RUN npm run build

EXPOSE 8080

CMD ["serve", "-s", "dist", "-l", "8080"]
