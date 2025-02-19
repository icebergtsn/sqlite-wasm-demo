<template>
  <q-layout>
    <q-page-container class="full-height full-width">
      <router-view/>
    </q-page-container>
  </q-layout>
</template>

<script setup lang="ts">

defineOptions({
  name: 'MainLayout'
});

</script>
