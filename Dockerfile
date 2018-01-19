FROM node

WORKDIR /app
ADD . /app
RUN cd /app && \
  npm install

VOLUME [ "/app/data" ]

EXPOSE 80

CMD [ "node", "/app/app.js" ]
