import { useQuery } from '@tanstack/react-query';
import type { components, paths } from '@whyme/api-client';
import { unwrap, useApi } from './api';
import { useOfflineFetcher } from './offline';

export type PublicVacancy = components['schemas']['PublicVacancyResource'];
export type OwnerVacancy = components['schemas']['OwnerVacancyResource'];
export type EmployerProfile = components['schemas']['EmployerProfileResource'];
export type EmployerOverview = paths['/v1/me/employer']['get']['responses'][200]['content']['application/json']['data'];
export type SeekerProfile = components['schemas']['SeekerProfileResource'];
export type Cv = components['schemas']['CvResource'];
export type SeekerOverview = paths['/v1/me/seeker']['get']['responses'][200]['content']['application/json']['data'];
export type EmploymentType = PublicVacancy['employment_type'];
export type VacancyStatus = OwnerVacancy['status'];
export type StoreVacancy = paths['/v1/me/vacancies']['post']['requestBody']['content']['application/json'];
export type UpdateVacancy = paths['/v1/me/vacancies/{vacancy}']['patch']['requestBody']['content']['application/json'];
export type SaveEmployerProfile = paths['/v1/me/employer']['put']['requestBody']['content']['application/json'];
export type SaveSeekerProfile = NonNullable<paths['/v1/me/seeker']['put']['requestBody']>['content']['application/json'];
export type AttachCvPayload = paths['/v1/me/cvs/upload']['post']['requestBody']['content']['application/json'];
export type GenerateCvPayload = NonNullable<paths['/v1/me/cvs/generate']['post']['requestBody']>['content']['application/json'];
export type JobApplication = components['schemas']['ApplicationResource'];
export type ApplicationStatus = components['schemas']['ApplicationStatus'];
export type SubmitApplicationPayload = NonNullable<paths['/v1/jobs/{vacancy}/apply']['post']['requestBody']>['content']['application/json'];
export type ApplicationActionPayload = paths['/v1/me/applications/{application}/review']['post']['requestBody']['content']['application/json'];

export interface PublicVacancyFilters {
  q?: string;
  category_id?: number;
  location_id?: number;
  employment_type?: EmploymentType;
  min_salary?: number;
}

export const jobKeys = {
  all: ['jobs'] as const,
  publicList: (filters: PublicVacancyFilters = {}) => ['jobs', 'public', filters] as const,
  publicDetail: (key: string) => ['jobs', 'public', 'detail', key] as const,
  employer: () => ['jobs', 'employer'] as const,
  myVacancies: (status?: VacancyStatus) => ['jobs', 'my-vacancies', status ?? 'all'] as const,
  myVacancy: (id: string) => ['jobs', 'my-vacancy', id] as const,
  seeker: () => ['jobs', 'seeker'] as const,
  myCvs: () => ['jobs', 'my-cvs'] as const,
  applications: (role: 'applicant' | 'employer', status?: ApplicationStatus, vacancyId?: string) =>
    ['jobs', 'applications', role, status ?? 'all', vacancyId ?? 'all'] as const,
  vacancyApplications: (vacancyId: string, status?: ApplicationStatus) =>
    ['jobs', 'vacancy-applications', vacancyId, status ?? 'all'] as const,
  application: (id: string) => ['jobs', 'application', id] as const,
  applicationCounts: () => ['jobs', 'application-counts'] as const,
};

export function usePublicVacancies(filters: PublicVacancyFilters = {}, enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: jobKeys.publicList(filters),
    queryFn: async () =>
      unwrap(await api.GET('/v1/jobs', { params: { query: filters } })).data as PublicVacancy[],
    enabled,
  });
}

export function usePublicVacancy(key: string, enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', `public:${key}`, async () =>
    unwrap(await api.GET('/v1/jobs/{vacancy}', { params: { path: { vacancy: key } } })).data as PublicVacancy,
  );
  return useQuery({
    queryKey: jobKeys.publicDetail(key),
    queryFn: fetcher,
    enabled: enabled && Boolean(key),
  });
}

export function useEmployerOverview(enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', 'employer-overview', async () =>
    unwrap(await api.GET('/v1/me/employer')).data as EmployerOverview,
  );
  return useQuery({
    queryKey: jobKeys.employer(),
    queryFn: fetcher,
    enabled,
  });
}

export function useMyVacancies(status?: VacancyStatus, enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', `my-vacancies:${status ?? 'all'}`, async () =>
    unwrap(await api.GET('/v1/me/vacancies', { params: { query: { status } } })).data as OwnerVacancy[],
  );
  return useQuery({
    queryKey: jobKeys.myVacancies(status),
    queryFn: fetcher,
    enabled,
  });
}

export function useMyVacancy(id: string | null, enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', `my-vacancy:${id ?? ''}`, async () =>
    unwrap(await api.GET('/v1/me/vacancies/{vacancy}', { params: { path: { vacancy: id! } } })).data as OwnerVacancy,
  );
  return useQuery({
    queryKey: jobKeys.myVacancy(id ?? ''),
    queryFn: fetcher,
    enabled: enabled && Boolean(id),
  });
}

export function useSeekerOverview(enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', 'seeker-overview', async () =>
    unwrap(await api.GET('/v1/me/seeker')).data as SeekerOverview,
  );
  return useQuery({
    queryKey: jobKeys.seeker(),
    queryFn: fetcher,
    enabled,
  });
}

export function useMyCvs(enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', 'my-cvs', async () =>
    unwrap(await api.GET('/v1/me/cvs')).data as Cv[],
  );
  return useQuery({
    queryKey: jobKeys.myCvs(),
    queryFn: fetcher,
    enabled,
  });
}

export function useApplications(
  role: 'applicant' | 'employer' = 'applicant',
  status?: ApplicationStatus,
  vacancyId?: string,
  enabled = true,
) {
  const api = useApi();
  const key = `applications:${role}:${status ?? 'all'}:${vacancyId ?? 'all'}`;
  const fetcher = useOfflineFetcher('jobs', key, async () =>
    unwrap(
      await api.GET('/v1/me/applications', {
        params: {
          query: {
            role,
            ...(status ? { status } : {}),
            ...(vacancyId ? { vacancy_id: vacancyId } : {}),
          },
        },
      }),
    ).data as JobApplication[],
  );
  return useQuery({
    queryKey: jobKeys.applications(role, status, vacancyId),
    queryFn: fetcher,
    enabled,
  });
}

export function useVacancyApplications(vacancyId: string | null, status?: ApplicationStatus, enabled = true) {
  const api = useApi();
  const key = `vacancy-applications:${vacancyId ?? ''}:${status ?? 'all'}`;
  const fetcher = useOfflineFetcher('jobs', key, async () =>
    unwrap(
      await api.GET('/v1/me/vacancies/{vacancy}/applications', {
        params: {
          path: { vacancy: vacancyId! },
          query: status ? { status } : {},
        },
      }),
    ).data as JobApplication[],
  );
  return useQuery({
    queryKey: jobKeys.vacancyApplications(vacancyId ?? '', status),
    queryFn: fetcher,
    enabled: enabled && Boolean(vacancyId),
  });
}

export function useApplication(id: string | null, enabled = true) {
  const api = useApi();
  const fetcher = useOfflineFetcher('jobs', `application:${id ?? ''}`, async () =>
    unwrap(
      await api.GET('/v1/me/applications/{application}', {
        params: { path: { application: id! } },
      }),
    ).data as JobApplication,
  );
  return useQuery({
    queryKey: jobKeys.application(id ?? ''),
    queryFn: fetcher,
    enabled: enabled && Boolean(id),
  });
}

export function useApplicationCounts(enabled = true) {
  const api = useApi();
  return useQuery({
    queryKey: jobKeys.applicationCounts(),
    queryFn: async () => unwrap(await api.GET('/v1/me/applications/counts')).data,
    enabled,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
}
