import 'reflect-metadata';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import {
  CreateBoardDto,
  CreateCandidateDto,
  CreateDebtDto,
  CreateIncidentDto,
  CreateProjectDto,
  CreateTaskDto,
  LoginDto,
  PaginationQueryDto,
  UpdateUserSettingsDto,
} from './request.dto';

describe('request DTO contracts', () => {
  it.each([
    [LoginDto, { email: 'member@example.com', password: 'password' }],
    [CreateBoardDto, { name: 'Board' }],
    [CreateTaskDto, { title: 'Task', status: 'TODO' }],
    [CreateProjectDto, { name: 'Project', departmentId: '1d813fc8-229d-4f66-83ad-72fd7d5b1254' }],
    [CreateCandidateDto, { name: 'Member', email: 'member@example.com' }],
    [CreateDebtDto, { description: 'Invoice', value: 10.5, type: 'OUTCOME' }],
    [CreateIncidentDto, { name: 'Outage', description: 'API unavailable' }],
    [UpdateUserSettingsDto, { darkMode: true, language: 'pt' }],
    [PaginationQueryDto, { page: '2', pageSize: '50' }],
  ])('%p accepts a valid payload', async (Dto, payload) => {
    const instance = plainToInstance(Dto, payload);
    await expect(validate(instance)).resolves.toHaveLength(0);
  });

  it.each([
    [LoginDto, { email: 'invalid', password: '' }],
    [CreateBoardDto, { name: '', departmentIds: ['not-a-uuid'] }],
    [CreateTaskDto, { title: '', status: 'INVALID' }],
    [CreateProjectDto, { name: 'Project', departmentId: 'invalid' }],
    [CreateCandidateDto, { name: 'Member', email: 'invalid' }],
    [CreateDebtDto, { description: 'Invoice', value: -1, type: 'INVALID' }],
    [CreateIncidentDto, { name: '', description: '' }],
    [UpdateUserSettingsDto, { darkMode: 'yes' }],
    [PaginationQueryDto, { page: '0', pageSize: '1001' }],
  ])('%p rejects an invalid payload', async (Dto, payload) => {
    const instance = plainToInstance(Dto, payload);
    expect(await validate(instance)).not.toHaveLength(0);
  });
});
