FROM resin/rpi-raspbian:jessie
LABEL version="1.0" \
      description=""

# Start QEMU support for building on all architectures
RUN [ "cross-build-start" ]

ADD https://repo.mosquitto.org/debian/mosquitto-repo.gpg.key .
RUN apt-key add mosquitto-repo.gpg.key
ADD https://repo.mosquitto.org/debian/mosquitto-jessie.list /etc/apt/sources.list.d/

RUN apt-get update && \
    apt-get upgrade -y && \
    apt-get install -y mosquitto && \
    rm -f mosquitto-repo.gpg.key

RUN adduser --system --disabled-password --disabled-login mosquitto

COPY config /mqtt/config

VOLUME ["/mqtt/config", "/mqtt/data", "/mqtt/log"]

EXPOSE 1883 9001
CMD ["/usr/sbin/mosquitto", "-c", "/mqtt/config/mosquitto.conf"]